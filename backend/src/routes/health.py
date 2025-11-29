from datetime import datetime, date, timedelta
from flask import Blueprint, jsonify, request

from tools.auth_helper import session_user
from tools.database import db_pool

health_blueprint = Blueprint("health", __name__, url_prefix="/api/health")


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
        return jsonify({"updated": len(records)}), 200
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
