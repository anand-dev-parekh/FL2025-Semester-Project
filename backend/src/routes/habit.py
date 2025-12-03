from flask import Blueprint, jsonify, request

from tools.auth_helper import ensure_auth
from tools.database import db_pool
from tools.habit_meta import allowed_habit_names, habit_meta, healthkit_habit_metas

habit_blueprint = Blueprint("habits", __name__, url_prefix="/api/habits")

@habit_blueprint.route("", methods=["GET"])
def get_habits():
    user, error = ensure_auth()
    if error:
        return error

    include_healthkit = str(request.args.get("include_healthkit", "")).lower() in ("1", "true", "yes")
    allowed_names = allowed_habit_names()
    healthkit_names = set(healthkit_habit_metas().keys())

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            if include_healthkit:
                cur.execute(
                    """
                    SELECT id, name, description
                    FROM habits
                    WHERE lower(name) = ANY(%s)
                    ORDER BY name;
                    """,
                    (list(allowed_names),),
                )
            else:
                cur.execute(
                    """
                    SELECT id, name, description
                    FROM habits
                    WHERE lower(name) = ANY(%s)
                      AND lower(name) NOT IN %s
                    ORDER BY name;
                    """,
                    (list(allowed_names), tuple(healthkit_names)),
                )
            rows = cur.fetchall()

        habits = []
        for habit_id, name, description in rows:
            meta = habit_meta(name)
            if not meta:
                continue  # ignore non-quant habits that may still be in the DB
            habits.append(
                {
                    "id": habit_id,
                    "name": meta["name"],
                    "description": description or meta.get("description") or "",
                    "unit": meta.get("unit"),
                    "default_target": meta.get("default_target"),
                    "health_metric": meta.get("health_metric"),
                    "uses_healthkit": bool(meta.get("health_metric")),
                }
            )
        return jsonify(habits)
    finally:
        db_pool.putconn(conn)
    
