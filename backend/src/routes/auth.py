from flask import request, session, jsonify, Blueprint
from tools.auth import session_user, verify_google_id_token 

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
    user = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "email_verified": claims.get("email_verified"),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
        # Add anything else you need from claims here
    }

    # Persist the session (signed cookie by Flask)
    session.clear()
    session.permanent = True
    session["user"] = user

    return jsonify(user), 200

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
