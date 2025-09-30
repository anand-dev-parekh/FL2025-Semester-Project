import os
from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth import auth_blueprint

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


    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"ok": True}), 200

    app.register_blueprint(auth_blueprint)

    return app

if __name__ == "__main__":

    load_dotenv()
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)