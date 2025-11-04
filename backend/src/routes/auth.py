from flask import request, session, jsonify, Blueprint
from tools.auth_helper import session_user, verify_google_id_token 
from tools.database import db_pool 

auth_blueprint = Blueprint("auth", __name__, url_prefix="/api/auth")


def _fetch_user(cursor, oauth_id: str):
    cursor.execute(
        """
        SELECT
            u.id,
            u.oauth_id,
            u.email,
            u.name,
            u.bio,
            u.level,
            u.streak,
            u.onboarding_complete,
            u.theme_preference,
            (
                SELECT COALESCE(SUM(g.xp), 0)
                FROM goals g
                WHERE g.user_id = u.id
            ) AS total_xp
        FROM users u
        WHERE u.oauth_id = %s
        """,
        (oauth_id,),
    )
    return cursor.fetchone()

@auth_blueprint.route("/google", methods=["POST"])
def auth_google():
    """
    Exchange Google ID token for a server session.
    Body: { "id_token": "<jwt from GIS>", "allow_create": true }
    Set allow_create to false when the client should only authenticate existing users.
    """
    data = request.get_json(silent=True) or {}
    token_str = data.get("id_token")
    allow_create = data.get("allow_create", True)
    if not token_str:
        return jsonify({"error": "Missing id_token"}), 400

    try:
        claims = verify_google_id_token(token_str)
    except Exception as e:
        return jsonify({"error": "Invalid token", "detail": str(e)}), 401

    # Build your app's user object from claims
    oauth_id = claims.get("sub")
    email = claims.get("email")
    name = claims.get("name")
    picture = claims.get("picture")

    if not oauth_id or not email:
        return jsonify({"error": "Token missing required fields"}), 400

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cursor:
            # Check if user already exists
            db_user = _fetch_user(cursor, oauth_id)

            if not db_user:
                if not allow_create:
                    conn.rollback()
                    return jsonify({"error": "Account not found"}), 403
                # Insert new user
                cursor.execute("""
                    INSERT INTO users (oauth_id, email, name, bio, level, streak)
                    VALUES (%s, %s, %s, %s, 1, 0)
                """, (oauth_id, email, name, ""))
                db_user = _fetch_user(cursor, oauth_id)

            # Commit changes
            conn.commit()

    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Database error", "detail": str(e)}), 500
    finally:
        db_pool.putconn(conn)  # Return connection to pool

    # Persist the session (signed cookie by Flask)
    session.clear()
    session.permanent = True

    user_payload = {
        "id": db_user[0],
        "oauth_id": db_user[1],
        "email": db_user[2],
        "name": db_user[3],
        "bio": db_user[4],
        "level": db_user[5],
        "streak": db_user[6],
        "onboarding_complete": db_user[7],
        "theme_preference": db_user[8],
        "xp": db_user[9],
        "picture": picture,
    }
    print(user_payload)
    session["user"] = user_payload

    return jsonify(session["user"]), 200

@auth_blueprint.route("/me", methods=["GET"])
def auth_me():
    """Return the logged-in user's profile or 401."""
    user = session_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(user), 200

@auth_blueprint.route("/logout", methods=["POST"])
def auth_logout():
    """Clear session."""
    session.clear()
    # Optionally, you can force the cookie to expire client-side:
    resp = jsonify({"ok": True})
    # Flask will overwrite the session cookie automatically; clearing session is enough.
    return resp, 200
