from datetime import datetime
from datetime import date as date_cls
from flask import Blueprint, jsonify, request
from tools.auth_helper import ensure_auth
from tools.database import db_pool
from tools.healthkit_goal_helper import calculate_health_xp, HEALTH_METRIC_KEYS, metric_unit

journal_blueprint = Blueprint("journal", __name__, url_prefix="/api/journal")

HEALTH_VALUE_MAP = {
    "steps": 0,
    "exercise_minutes": 1,
    "sleep_minutes": 2,
}


def _parse_date(value):
    if isinstance(value, date_cls):
        return value
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_numeric_value(raw):
    if raw is None:
        return None
    if isinstance(raw, bool):
        raise ValueError("value must be numeric")
    try:
        return float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("value must be numeric") from exc


def _health_value_from_row(health_metric, row):
    if not health_metric or row is None:
        return None
    metric_key = str(health_metric).strip().lower()
    idx = HEALTH_VALUE_MAP.get(metric_key)
    if idx is None:
        return None
    try:
        return row[idx]
    except IndexError:
        return None


def _entry_payload(row):
    health_metric = row[13]
    uses_healthkit = row[12]
    target_value = row[14]
    target_unit = row[15]
    numeric_value = row[16]
    numeric_unit = row[17] or target_unit
    # row[18:21] are steps, exercise_minutes, sleep_minutes from the LEFT JOIN
    raw_health_values = row[18:21]
    health_value = _health_value_from_row(health_metric, raw_health_values)
    value_used = health_value if uses_healthkit and health_value is not None else numeric_value
    value_ratio = None
    if target_value and value_used is not None:
        try:
            value_ratio = float(value_used) / float(target_value)
        except (TypeError, ValueError, ZeroDivisionError):
            value_ratio = None

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
        "uses_healthkit": uses_healthkit,
        "health_metric": health_metric,
        "target_value": target_value,
        "target_unit": target_unit,
        "numeric_value": numeric_value,
        "numeric_unit": numeric_unit,
        "health_value": health_value,
        "health_source": row[21],
        "value_ratio": value_ratio,
        "value_used": value_used,
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
            g.xp,
            g.uses_healthkit,
            g.health_metric,
            g.target_value,
            g.target_unit,
            je.numeric_value,
            je.numeric_unit,
            hm.steps,
            hm.exercise_minutes,
            hm.sleep_minutes,
            hm.source
        FROM journal_entries je
        JOIN goals g ON g.id = je.goal_id
        JOIN habits h ON h.id = g.habit_id
        LEFT JOIN user_health_metrics hm ON hm.user_id = je.user_id AND hm.metric_date = je.entry_date
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
    raw_value = data.get("value", data.get("entry_value"))
    value_unit = (data.get("value_unit") or data.get("entry_unit") or "").strip() or None

    if goal_id is None:
        return jsonify({"error": "goal_id is required"}), 400
    try:
        goal_id = int(goal_id)
    except (TypeError, ValueError):
        return jsonify({"error": "goal_id must be an integer"}), 400

    if not entry_date:
        return jsonify({"error": "entry_date must be provided in YYYY-MM-DD format"}), 400

    try:
        entry_value = _parse_numeric_value(raw_value) if raw_value is not None else None
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, habit_id, uses_healthkit, health_metric, target_value, target_unit
                    FROM goals
                    WHERE id = %s
                    """,
                    (goal_id,),
                )
                goal_row = cur.fetchone()
                if not goal_row or goal_row[1] != user["id"]:
                    return jsonify({"error": "Goal not found"}), 404

                _, _, habit_id, uses_healthkit, goal_health_metric, goal_target_value, goal_target_unit = goal_row
                if goal_target_value is None or goal_target_value <= 0:
                    return jsonify({"error": "This goal needs a numeric target to track progress."}), 400

                health_row = None
                health_value = None
                numeric_unit = value_unit or goal_target_unit

                if uses_healthkit and goal_health_metric in HEALTH_METRIC_KEYS:
                    cur.execute(
                        """
                        SELECT steps, exercise_minutes, sleep_minutes, source
                        FROM user_health_metrics
                        WHERE user_id = %s AND metric_date = %s
                        """,
                        (user["id"], entry_date),
                    )
                    health_row = cur.fetchone()
                    numeric_unit = numeric_unit or metric_unit(goal_health_metric)
                    if health_row:
                        health_value = _health_value_from_row(goal_health_metric, health_row[:3])

                if not uses_healthkit and entry_value is None:
                    return jsonify({"error": "value is required for this habit"}), 400

                value_used = health_value if health_value is not None else entry_value
                if value_used is None:
                    xp_delta, completion_level, _ = 0, "missed", 0.0
                else:
                    xp_delta, completion_level, _ = calculate_health_xp(value_used, goal_target_value)

                if not reflection and value_used is not None:
                    unit = numeric_unit or metric_unit(goal_health_metric) or ""
                    if uses_healthkit and health_value is not None:
                        reflection = f"Auto-tracked from HealthKit: {value_used} {unit} toward a goal of {goal_target_value} {unit}."
                    else:
                        reflection = f"Logged {value_used} {unit} toward a goal of {goal_target_value} {unit}."

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
                numeric_value = value_used
                numeric_unit = numeric_unit or goal_target_unit or metric_unit(goal_health_metric)

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
                            numeric_value = %s,
                            numeric_unit = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (reflection, xp_delta, completion_level, numeric_value, numeric_unit, entry_id),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO journal_entries (user_id, goal_id, entry_date, reflection, xp_delta, completion_level, numeric_value, numeric_unit)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            user["id"],
                            goal_id,
                            entry_date,
                            reflection,
                            xp_delta,
                            completion_level,
                            numeric_value,
                            numeric_unit,
                        ),
                    )
                    entry_id = cur.fetchone()[0]

                cur.execute(
                    """
                    UPDATE goals
                    SET xp = GREATEST(0, xp + %s)
                    WHERE id = %s AND user_id = %s
                    RETURNING xp, habit_id, goal_text, uses_healthkit, health_metric, target_value, target_unit
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
                        g.xp,
                        g.uses_healthkit,
                        g.health_metric,
                        g.target_value,
                        g.target_unit,
                        je.numeric_value,
                        je.numeric_unit,
                        hm.steps,
                        hm.exercise_minutes,
                        hm.sleep_minutes,
                        hm.source
                    FROM journal_entries je
                    JOIN goals g ON g.id = je.goal_id
                    JOIN habits h ON h.id = g.habit_id
                    LEFT JOIN user_health_metrics hm ON hm.user_id = je.user_id AND hm.metric_date = je.entry_date
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
                "uses_healthkit": goal_update[3],
                "health_metric": goal_update[4],
                "target_value": goal_update[5],
                "target_unit": goal_update[6],
            },
        }
        return jsonify(response_body), status_code
    finally:
        db_pool.putconn(conn)
