from flask import session, current_app
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

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
        audience=current_app.config["GOOGLE_OAUTH_CLIENT_ID"],  # verifies aud
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
