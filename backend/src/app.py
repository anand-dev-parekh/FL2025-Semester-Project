import os
from datetime import timedelta
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

# -----------------------------
# Config
# -----------------------------
def create_app():
    app = Flask(__name__)

    # ENV VARS you must set:
    #   SECRET_KEY=... (any long random string)
    #   GOOGLE_OAUTH_CLIENT_ID=1234567890-abcdefgh.apps.googleusercontent.com
    frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    app.config["GOOGLE_OAUTH_CLIENT_ID"] = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

    # Secure cookie settings
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    # Use Secure cookies if you serve over HTTPS (recommended). For localhost HTTP, you can keep False.
    app.config["SESSION_COOKIE_SECURE"] = False if os.environ.get("DEV_HTTP", "1") == "1" else True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"  # or "Strict" if you don't need cross-site posts

    # CORS for your SPA origin; credentials are required for cookies
    CORS(
        app,
        resources={r"/api/*": {"origins": [frontend_origin]}},
        supports_credentials=True,
        allow_headers=["Content-Type"],
        methods=["GET", "POST", "OPTIONS"],
    )

    # -----------------------------
    # Helpers
    # -----------------------------
    def verify_google_id_token(id_token_str: str):
        """
        Verifies a Google ID token and returns its claims dict if valid, else raises.
        """
        claims = id_token.verify_oauth2_token(
            id_token_str,
            grequests.Request(),
            audience=app.config["GOOGLE_OAUTH_CLIENT_ID"],  # verifies aud
        )
        # Optional additional checks:
        if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Invalid issuer.")
        return claims

    def session_user():
        """Return user info from session if present."""
        if "user" in session:
            return session["user"]
        return None

    # -----------------------------
    # Routes
    # -----------------------------
    @app.route("/api/auth/google", methods=["POST"])
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

    @app.route("/api/auth/me", methods=["GET"])
    def auth_me():
        """Return the logged-in user's profile or 401."""
        user = session_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        return jsonify(user), 200

    @app.route("/api/auth/logout", methods=["POST"])
    def auth_logout():
        """Clear session."""
        session.clear()
        # Optionally, you can force the cookie to expire client-side:
        resp = jsonify({"ok": True})
        # Flask will overwrite the session cookie automatically; clearing session is enough.
        return resp, 200

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"ok": True}), 200

    return app


app = create_app()

if __name__ == "__main__":
    # Dev server
    # Run with: FRONTEND_ORIGIN=http://localhost:5173 SECRET_KEY=... GOOGLE_OAUTH_CLIENT_ID=... python app.py
    app.run(host="0.0.0.0", port=5000, debug=True)
