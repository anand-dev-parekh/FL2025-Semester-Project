from datetime import datetime
from datetime import date as date_cls
from flask import Blueprint, jsonify, request
from tools.auth_helper import ensure_auth
from tools.database import db_pool

journal_blueprint = Blueprint("journal", __name__, url_prefix="/api/journal")

COMPLETION_TO_XP = {
    "missed": 0,
    "partial": 5,
    "complete": 10,
}
DEFAULT_COMPLETION_LEVEL = "partial"


def _parse_date(value):
    if isinstance(value, date_cls):
        return value
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _normalize_completion_level(value):
    if value is None:
        return DEFAULT_COMPLETION_LEVEL
    level = str(value).strip().lower()
    if not level:
        return DEFAULT_COMPLETION_LEVEL
    if level not in COMPLETION_TO_XP:
        return None
    return level


def _entry_payload(row):
    return {
        "id": row[0],
        "goal_id": row[1],
        "habit_id": row[2],
        "habit_name": row[3],
        "goal_text": row[4],
        "entry_date": row[5].isoformat() if row[5] else None,
        "reflection": row[6],
        "completion_level": row[7],
        "xp_delta": row[8],
        "created_at": row[9].isoformat() if row[9] else None,
        "updated_at": row[10].isoformat() if row[10] else None,
        "goal_xp": row[11],
    }


@journal_blueprint.route("/entries", methods=["GET"])
def list_entries():
    user, error = ensure_auth()
    if error:
        return error

    goal_id = request.args.get("goal_id")
    start_date = _parse_date(request.args.get("from"))
    end_date = _parse_date(request.args.get("to"))
    limit = request.args.get("limit")

    params = [user["id"]]
    where_clauses = ["je.user_id = %s"]

    if goal_id is not None:
        try:
            goal_id_int = int(goal_id)
            where_clauses.append("je.goal_id = %s")
            params.append(goal_id_int)
        except (TypeError, ValueError):
            return jsonify({"error": "goal_id must be an integer"}), 400

    if start_date:
        where_clauses.append("je.entry_date >= %s")
        params.append(start_date)

    if end_date:
        where_clauses.append("je.entry_date <= %s")
        params.append(end_date)

    sql = """
        SELECT
            je.id,
            je.goal_id,
            g.habit_id,
            h.name,
            g.goal_text,
            je.entry_date,
            je.reflection,
            je.completion_level,
            je.xp_delta,
            je.created_at,
            je.updated_at,
            g.xp
        FROM journal_entries je
        JOIN goals g ON g.id = je.goal_id
        JOIN habits h ON h.id = g.habit_id
        WHERE {where}
        ORDER BY je.entry_date DESC, je.id DESC
    """.format(where=" AND ".join(where_clauses))

    if limit:
        try:
            limit_value = max(1, min(500, int(limit)))
            sql += " LIMIT %s"
            params.append(limit_value)
        except (TypeError, ValueError):
            return jsonify({"error": "limit must be an integer"}), 400

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        entries = [_entry_payload(r) for r in rows]
        return jsonify(entries)
    finally:
        db_pool.putconn(conn)


@journal_blueprint.route("/entries", methods=["POST"])
def upsert_entry():
    user, error = ensure_auth()
    if error:
        return error

    data = request.get_json(silent=True) or {}

    goal_id = data.get("goal_id")
    entry_date = _parse_date(data.get("entry_date"))
    reflection = (data.get("reflection") or "").strip()
    completion_level = _normalize_completion_level(data.get("completion_level"))

    if goal_id is None:
        return jsonify({"error": "goal_id is required"}), 400
    try:
        goal_id = int(goal_id)
    except (TypeError, ValueError):
        return jsonify({"error": "goal_id must be an integer"}), 400

    if not entry_date:
        return jsonify({"error": "entry_date must be provided in YYYY-MM-DD format"}), 400

    if completion_level is None:
        return jsonify(
            {
                "error": "completion_level must be one of "
                + ", ".join(sorted(COMPLETION_TO_XP.keys()))
            },
        ), 400

    xp_delta = COMPLETION_TO_XP[completion_level]

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id
                    FROM goals
                    WHERE id = %s
                    """,
                    (goal_id,),
                )
                goal_row = cur.fetchone()
                if not goal_row or goal_row[1] != user["id"]:
                    return jsonify({"error": "Goal not found"}), 404

                cur.execute(
                    """
                    SELECT id, xp_delta
                    FROM journal_entries
                    WHERE user_id = %s AND goal_id = %s AND entry_date = %s
                    FOR UPDATE
                    """,
                    (user["id"], goal_id, entry_date),
                )
                existing = cur.fetchone()

                xp_diff = xp_delta
                entry_id = None
                created = existing is None

                if existing:
                    entry_id = existing[0]
                    previous_xp = existing[1] or 0
                    xp_diff = xp_delta - previous_xp
                    cur.execute(
                        """
                        UPDATE journal_entries
                        SET reflection = %s,
                            xp_delta = %s,
                            completion_level = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (reflection, xp_delta, completion_level, entry_id),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO journal_entries (user_id, goal_id, entry_date, reflection, xp_delta, completion_level)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (user["id"], goal_id, entry_date, reflection, xp_delta, completion_level),
                    )
                    entry_id = cur.fetchone()[0]

                cur.execute(
                    """
                    UPDATE goals
                    SET xp = GREATEST(0, xp + %s)
                    WHERE id = %s AND user_id = %s
                    RETURNING xp, habit_id, goal_text
                    """,
                    (xp_diff, goal_id, user["id"]),
                )
                goal_update = cur.fetchone()
                if not goal_update:
                    conn.rollback()
                    return jsonify({"error": "Failed to update goal XP"}), 500

                cur.execute(
                    """
                    SELECT
                        je.id,
                        je.goal_id,
                        g.habit_id,
                        h.name,
                        g.goal_text,
                        je.entry_date,
                        je.reflection,
                        je.completion_level,
                        je.xp_delta,
                        je.created_at,
                        je.updated_at,
                        g.xp
                    FROM journal_entries je
                    JOIN goals g ON g.id = je.goal_id
                    JOIN habits h ON h.id = g.habit_id
                    WHERE je.id = %s
                    """,
                    (entry_id,),
                )
                entry_row = cur.fetchone()

        payload = _entry_payload(entry_row) if entry_row else None
        status_code = 201 if created else 200
        response_body = {
            "entry": payload,
            "goal": {
                "id": goal_id,
                "habit_id": goal_update[1],
                "goal_text": goal_update[2],
                "xp": goal_update[0],
            },
        }
        return jsonify(response_body), status_code
    finally:
        db_pool.putconn(conn)
