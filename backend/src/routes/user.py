from flask import request, jsonify, Blueprint
from tools.auth_helper import session_user
from tools.database import db_pool 

user_blueprint = Blueprint("user", __name__, url_prefix="/api/user")

@user_blueprint.route("/me", methods=["GET"])
def get_user():
    user = session_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, oauth_id, email, name, bio, level, streak, created_at
                FROM users
                WHERE id = %s
            """, (user["id"],))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "User not found"}), 404
            user = {
                "id": row[0],
                "oauth_id": row[1],
                "email": row[2],
                "name": row[3],
                "bio": row[4],
                "level": row[5],
                "streak": row[6],
                "created_at": row[7].isoformat() if row[7] else None,
            }
            return jsonify(user)
    finally:
        db_pool.putconn(conn)

@user_blueprint.route("/me", methods=["PATCH"])
def update_user():
    u = session_user()
    if not u or not u.get("id"):
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    bio  = (data.get("bio") or "").strip() or None   # empty -> NULL

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE users
                    SET name = %s, bio = %s
                    WHERE id = %s
                    RETURNING id, oauth_id, email, name, bio, level, streak, created_at
                """, (name, bio, u["id"]))
                row = cur.fetchone()
                if not row:
                    return jsonify({"error":"User not found"}), 404
                return jsonify({
                    "id": row[0], "oauth_id": row[1], "email": row[2],
                    "name": row[3], "bio": row[4], "level": row[5],
                    "streak": row[6], "created_at": row[7].isoformat() if row[7] else None,
                })
    finally:
        db_pool.putconn(conn)
