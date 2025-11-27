from flask import request, jsonify, Blueprint, session
from tools.auth_helper import ensure_auth
from tools.database import db_pool 

user_blueprint = Blueprint("user", __name__, url_prefix="/api/user")

@user_blueprint.route("/me", methods=["GET"])
def get_user():
    user, error = ensure_auth()
    if error:
        return error
    
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, oauth_id, email, name, bio, level, streak, created_at, onboarding_complete, theme_preference
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
                "onboarding_complete": row[8],
                "theme_preference": row[9],
            }
            return jsonify(user)
    finally:
        db_pool.putconn(conn)

@user_blueprint.route("/me", methods=["PATCH"])
def update_user():
    u, error = ensure_auth()
    if error:
        return error

    data = request.get_json() or {}

    updates = {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name cannot be empty"}), 400
        updates["name"] = name

    if "bio" in data:
        bio = (data.get("bio") or "").strip()
        updates["bio"] = bio or None

    if "onboarding_complete" in data:
        oc = data.get("onboarding_complete")
        if not isinstance(oc, bool):
            return jsonify({"error": "onboarding_complete must be a boolean"}), 400
        updates["onboarding_complete"] = oc

    if "theme_preference" in data:
        pref = (data.get("theme_preference") or "").strip().lower()
        allowed = {"light", "dark", "system"}
        if pref not in allowed:
            return jsonify({"error": "theme_preference must be 'light', 'dark', or 'system'"}), 400
        updates["theme_preference"] = pref

    if not updates:
        return jsonify({"error": "No fields to update"}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                fields = ", ".join(f"{col} = %s" for col in updates.keys())
                params = list(updates.values()) + [u["id"]]
                cur.execute(
                    f"""
                    UPDATE users
                    SET {fields}
                    WHERE id = %s
                    RETURNING id, oauth_id, email, name, bio, level, streak, created_at, onboarding_complete, theme_preference
                    """,
                    params,
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error":"User not found"}), 404
                updated_user = {
                    "id": row[0],
                    "oauth_id": row[1],
                    "email": row[2],
                    "name": row[3],
                    "bio": row[4],
                    "level": row[5],
                    "streak": row[6],
                    "created_at": row[7].isoformat() if row[7] else None,
                    "onboarding_complete": row[8],
                    "theme_preference": row[9],
                }
                # Keep session in sync so subsequent /auth/me reflects changes
                if "user" in session:
                    session["user"] = {
                        **session["user"],
                        **{
                            "name": updated_user["name"],
                            "bio": updated_user["bio"],
                            "onboarding_complete": updated_user["onboarding_complete"],
                            "theme_preference": updated_user["theme_preference"],
                        },
                    }
                return jsonify(updated_user)
    finally:
        db_pool.putconn(conn)
