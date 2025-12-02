from flask import request, jsonify, Blueprint
from tools.auth_helper import ensure_auth
from tools.database import db_pool 

HEALTHKIT_HABITS = {"exercise", "steps", "sleep well"}

habit_blueprint = Blueprint("habits", __name__, url_prefix="/api/habits")

@habit_blueprint.route("", methods=["GET"])
def get_habits():
    user, error = ensure_auth()
    if error:
        return error

    include_healthkit = str(request.args.get("include_healthkit", "")).lower() in ("1", "true", "yes")

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            if include_healthkit:
                cur.execute(
                    """
                    SELECT id, name, description
                    FROM habits
                    ORDER BY name;
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT id, name, description
                    FROM habits
                    WHERE lower(name) NOT IN %s
                    ORDER BY name;
                    """,
                    (tuple(HEALTHKIT_HABITS),),
                )
            rows = cur.fetchall()

        habits = [
            {"id": r[0], "name": r[1], "description": r[2]}
            for r in rows
        ]
        return jsonify(habits)
    finally:
        db_pool.putconn(conn)
    
