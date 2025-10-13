from flask import request, session, jsonify, Blueprint
from tools.auth_helper import session_user, verify_google_id_token 
from tools.database import db_pool 

auth_blueprint = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_blueprint.route("/google", methods=["POST"])
def auth_google():
    """
    Exchange Google ID token for a server session.
    Body: { "id_token": "<jwt from GIS>" }
    """
    data = request.get_json(silent=True) or {}
    token_str = data.get("id_token")
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
            cursor.execute("SELECT id, oauth_id, email, level, streak FROM users WHERE oauth_id = %s", (oauth_id,))
            row = cursor.fetchone()
            if row:
                user_id, _, _, _, _= row
            else:
                # Insert new user
                cursor.execute("""
                    INSERT INTO users (oauth_id, email, name, bio, level, streak)
                    VALUES (%s, %s, %s, %s, 1, 0)
                    RETURNING id
                """, (oauth_id, email, name, ''))
                user_id = cursor.fetchone()[0]
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

    session["user"] = {
        "id": user_id,
        "oauth_id": oauth_id,
        "email": email,
        "name": name,
        "level": row[3] if row else 1,
        "streak": row[4] if row else 0,
        "picture": picture,
    }

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
