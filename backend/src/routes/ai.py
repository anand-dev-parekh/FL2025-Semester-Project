import os

import requests
from flask import Blueprint, jsonify, request

from tools.auth_helper import ensure_auth

ai_blueprint = Blueprint("ai", __name__, url_prefix="/api/ai")

DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "phi3:mini"


def _ollama_settings():
    """
    Return sanitized Ollama base URL and preferred model.
    """
    base_url = os.environ.get("OLLAMA_BASE_URL", DEFAULT_OLLAMA_URL).strip() or DEFAULT_OLLAMA_URL
    model = os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL).strip() or DEFAULT_OLLAMA_MODEL
    return base_url.rstrip("/"), model


@ai_blueprint.route("/respond", methods=["POST"])
def ollama_respond():
    """
    Call an Ollama model with the provided prompt and optional system prompt/context.
    """
    user, error = ensure_auth()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    system_prompt = (payload.get("system_prompt") or "").strip()
    context = payload.get("context")
    if context is not None and not isinstance(context, list):
        return jsonify({"error": "context must be a list of integers if provided"}), 400

    base_url, model = _ollama_settings()
    request_body = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if system_prompt:
        request_body["system"] = system_prompt
    if context:
        request_body["context"] = context

    try:
        resp = requests.post(f"{base_url}/api/generate", json=request_body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": f"Ollama request failed: {exc}"}), 502
    except ValueError:
        return jsonify({"error": "Invalid JSON received from Ollama"}), 502

    response_text = data.get("response")
    if not response_text:
        return jsonify({"error": "Ollama response missing 'response'"}), 502

    result = {
        "prompt": prompt,
        "response": response_text,
        "model": data.get("model") or model,
        "user_id": user["id"],
        "meta": {
            "created_at": data.get("created_at"),
            "total_duration": data.get("total_duration"),
            "load_duration": data.get("load_duration"),
            "eval_count": data.get("eval_count"),
            "eval_duration": data.get("eval_duration"),
        },
    }

    response_context = data.get("context")
    if response_context:
        result["context"] = response_context

    return jsonify(result), 200
