from flask import request, jsonify, Blueprint
from tools.auth_helper import ensure_auth
from tools.database import db_pool 

habit_blueprint = Blueprint("habits", __name__, url_prefix="/api/habits")

@habit_blueprint.route("", methods=["GET"])
def get_habits():
    user, error = ensure_auth()
    if error:
        return error
    
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, description
                FROM habits
                ORDER BY name;
            """)
            rows = cur.fetchall()

        habits = [
            {"id": r[0], "name": r[1], "description": r[2]}
            for r in rows
        ]
        return jsonify(habits)
    finally:
        db_pool.putconn(conn)
    
