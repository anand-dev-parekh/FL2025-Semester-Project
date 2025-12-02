from datetime import datetime, date, timedelta
from flask import Blueprint, jsonify, request

from tools.auth_helper import session_user
from tools.database import db_pool
from tools.healthkit_goal_helper import calculate_health_xp, HEALTH_METRIC_KEYS, metric_unit
from tools.healthkit_goal_helper import HEALTHKIT_HABIT_METRICS

health_blueprint = Blueprint("health", __name__, url_prefix="/api/health")
HEALTHKIT_DEFAULT_TARGETS = {
    "steps": 8000,
    "exercise_minutes": 30,
    "sleep_minutes": 480,
}


def _parse_records(payload):
    records = payload.get("records")
    if not isinstance(records, list) or len(records) == 0:
        raise ValueError("records must be a non-empty list")

    parsed = []
    for idx, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"records[{idx}] must be an object")

        date_str = record.get("date")
        if not isinstance(date_str, str):
            raise ValueError(f"records[{idx}].date must be a string in YYYY-MM-DD format")
        try:
            metric_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"records[{idx}].date is invalid: {exc}") from exc

        def parse_int(key):
            value = record.get(key, 0)
            if value is None:
                value = 0
            if isinstance(value, bool):
                raise ValueError(f"records[{idx}].{key} must be an integer")
            try:
                value_int = int(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"records[{idx}].{key} must be an integer") from exc
            if value_int < 0:
                raise ValueError(f"records[{idx}].{key} must be zero or greater")
            return value_int

        steps = parse_int("steps")
        exercise_minutes = parse_int("exercise_minutes")
        sleep_minutes = parse_int("sleep_minutes")
        source = record.get("source") or "apple_health"
        if not isinstance(source, str):
            raise ValueError(f"records[{idx}].source must be a string")

        parsed.append((metric_date, steps, exercise_minutes, sleep_minutes, source))

    return parsed


def _sync_healthkit_goals(conn, user_id, records):
    """Upsert journal entries for HealthKit-backed goals based on the new records."""
    if not records:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, health_metric, target_value, target_unit
            FROM goals
            WHERE user_id = %s
              AND uses_healthkit = TRUE
              AND health_metric IS NOT NULL
              AND target_value IS NOT NULL
            """,
            (user_id,),
        )
        goal_rows = cur.fetchall()

    if not goal_rows:
        return

    goals = [
        {
            "id": row[0],
            "health_metric": row[1],
            "target_value": row[2],
            "target_unit": row[3],
        }
        for row in goal_rows
        if row[1] in HEALTH_METRIC_KEYS
    ]
    if not goals:
        return

    for metric_date, steps, exercise_minutes, sleep_minutes, source in records:
        metrics = {
            "steps": steps,
            "exercise_minutes": exercise_minutes,
            "sleep_minutes": sleep_minutes,
        }
        for goal in goals:
            metric_key = goal["health_metric"]
            actual_value = metrics.get(metric_key)
            xp_delta, completion_level, _ = calculate_health_xp(actual_value, goal["target_value"])
            auto_note = (
                f"Auto-tracked from HealthKit: {actual_value} {metric_unit(metric_key) or ''} "
                f"toward a goal of {goal['target_value']} {goal['target_unit'] or metric_unit(metric_key) or ''}."
            ).strip()

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, xp_delta, reflection
                    FROM journal_entries
                    WHERE user_id = %s AND goal_id = %s AND entry_date = %s
                    FOR UPDATE
                    """,
                    (user_id, goal["id"], metric_date),
                )
                existing = cur.fetchone()

                xp_diff = xp_delta
                entry_id = None
                if existing:
                    entry_id = existing[0]
                    prev_xp = existing[1] or 0
                    xp_diff = xp_delta - prev_xp
                    reflection = existing[2] or auto_note
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
                        (user_id, goal["id"], metric_date, auto_note, xp_delta, completion_level),
                    )
                    entry_id = cur.fetchone()[0]

                cur.execute(
                    """
                    UPDATE goals
                    SET xp = GREATEST(0, xp + %s)
                    WHERE id = %s AND user_id = %s
                    """,
                    (xp_diff, goal["id"], user_id),
                )


@health_blueprint.route("/daily", methods=["POST"])
def upsert_daily_health():
    user = session_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    try:
        records = _parse_records(payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                for metric_date, steps, exercise_minutes, sleep_minutes, source in records:
                    cur.execute(
                        """
                        INSERT INTO user_health_metrics (user_id, metric_date, steps, exercise_minutes, sleep_minutes, source)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (user_id, metric_date)
                        DO UPDATE SET
                            steps = EXCLUDED.steps,
                            exercise_minutes = EXCLUDED.exercise_minutes,
                            sleep_minutes = EXCLUDED.sleep_minutes,
                            source = EXCLUDED.source,
                            updated_at = now()
                        """,
                        (user["id"], metric_date, steps, exercise_minutes, sleep_minutes, source),
                    )
            _sync_healthkit_goals(conn, user["id"], records)
        return jsonify({"updated": len(records)}), 200
    finally:
        db_pool.putconn(conn)


@health_blueprint.route("/enable", methods=["POST"])
def enable_healthkit_goals():
    """
    Create or update default HealthKit-backed goals (steps/exercise/sleep) for the current user.
    """
    user = session_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, lower(name) AS name
                    FROM habits
                    WHERE lower(name) IN %s
                    """,
                    (tuple(HEALTHKIT_HABIT_METRICS.keys()),),
                )
                habits = {row[1]: row[0] for row in cur.fetchall()}

                missing = [name for name in HEALTHKIT_HABIT_METRICS.keys() if name not in habits]
                if missing:
                    return (
                        jsonify(
                            {
                                "error": "Required HealthKit habits are missing.",
                                "missing": missing,
                            }
                        ),
                        500,
                    )

                created = []
                for habit_name, meta in HEALTHKIT_HABIT_METRICS.items():
                    metric_key = meta["metric"]
                    target = HEALTHKIT_DEFAULT_TARGETS.get(metric_key, 0)
                    habit_id = habits[habit_name]
                    goal_text = ""
                    if metric_key == "steps":
                        goal_text = f"Walk {target} steps per day."
                    elif metric_key == "exercise_minutes":
                        goal_text = f"Get {target} active minutes daily."
                    elif metric_key == "sleep_minutes":
                        goal_text = f"Sleep {(target / 60):.1f} hours each night."
                    else:
                        goal_text = f"Track your {metric_key} daily."

                    cur.execute(
                        """
                        SELECT id FROM goals
                        WHERE user_id = %s AND habit_id = %s AND uses_healthkit = TRUE
                        """,
                        (user["id"], habit_id),
                    )
                    existing_goal = cur.fetchone()

                    if existing_goal:
                        cur.execute(
                            """
                            UPDATE goals
                            SET goal_text = %s,
                                health_metric = %s,
                                target_value = %s,
                                target_unit = %s,
                                uses_healthkit = TRUE,
                                completed = FALSE
                            WHERE id = %s
                            RETURNING id, habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit, created_at
                            """,
                            (
                                goal_text,
                                metric_key,
                                target,
                                metric_unit(metric_key),
                                existing_goal[0],
                            ),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO goals (user_id, habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit)
                            VALUES (%s, %s, %s, 0, FALSE, TRUE, %s, %s, %s)
                            RETURNING id, habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit, created_at
                            """,
                            (
                                user["id"],
                                habit_id,
                                goal_text,
                                metric_key,
                                target,
                                metric_unit(metric_key),
                            ),
                        )
                    created.append(cur.fetchone())

        goals_payload = []
        for row in created:
            goals_payload.append(
                {
                    "id": row[0],
                    "habit_id": row[1],
                    "goal_text": row[2],
                    "xp": row[3],
                    "completed": row[4],
                    "uses_healthkit": row[5],
                    "health_metric": row[6],
                    "target_value": row[7],
                    "target_unit": row[8],
                    "created_at": row[9].isoformat() if row[9] else None,
                }
            )
        return jsonify({"goals": goals_payload}), 200
    finally:
        db_pool.putconn(conn)


@health_blueprint.route("/daily", methods=["GET"])
def get_daily_health():
    user = session_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    days_param = request.args.get("days", default="7")
    try:
        days = int(days_param)
    except (TypeError, ValueError):
        return jsonify({"error": "days must be an integer"}), 400

    days = max(1, min(days, 30))
    since_date = date.today() - timedelta(days=days - 1)

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT metric_date, steps, exercise_minutes, sleep_minutes, source, updated_at
                FROM user_health_metrics
                WHERE user_id = %s AND metric_date >= %s
                ORDER BY metric_date DESC
                """,
                (user["id"], since_date),
            )
            rows = cur.fetchall()

        records = [
            {
                "date": row[0].isoformat(),
                "steps": row[1],
                "exercise_minutes": row[2],
                "sleep_minutes": row[3],
                "source": row[4],
                "updated_at": row[5].isoformat() if row[5] else None,
            }
            for row in rows
        ]
        return jsonify({"records": records})
    finally:
        db_pool.putconn(conn)
