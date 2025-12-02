from __future__ import annotations

from typing import Dict, Optional

# Central catalog of the quantitative habits we support. Keep names lowercase for matching.
QUANTITATIVE_HABITS: Dict[str, Dict[str, object]] = {
    "exercise": {
        "name": "Exercise",
        "description": "Minutes of moderate-to-vigorous movement.",
        "unit": "minutes",
        "default_target": 30,
        "health_metric": "exercise_minutes",
    },
    "steps": {
        "name": "Steps",
        "description": "Daily step count.",
        "unit": "steps",
        "default_target": 8000,
        "health_metric": "steps",
    },
    "sleep well": {
        "name": "Sleep Well",
        "description": "Minutes of quality sleep.",
        "unit": "minutes",
        "default_target": 480,
        "health_metric": "sleep_minutes",
    },
    "hydration": {
        "name": "Hydration",
        "description": "Ounces of water you drink.",
        "unit": "oz",
        "default_target": 80,
    },
    "mindfulness": {
        "name": "Mindfulness",
        "description": "Minutes spent meditating or practicing breath work.",
        "unit": "minutes",
        "default_target": 10,
    },
    "learning": {
        "name": "Learning",
        "description": "Minutes invested in studying or reading.",
        "unit": "minutes",
        "default_target": 30,
    },
    "creativity": {
        "name": "Creativity",
        "description": "Minutes spent making something (art, music, writing).",
        "unit": "minutes",
        "default_target": 20,
    },
    "nature time": {
        "name": "Nature Time",
        "description": "Minutes spent outdoors or on a walk.",
        "unit": "minutes",
        "default_target": 20,
    },
    "financial awareness": {
        "name": "Financial Awareness",
        "description": "Dollars saved, invested, or intentionally budgeted.",
        "unit": "dollars",
        "default_target": 20,
    },
    "digital balance": {
        "name": "Digital Balance",
        "description": "Minutes of intentional screen-free time.",
        "unit": "minutes",
        "default_target": 60,
    },
}

# Keep a list of the legacy non-quantifiable habits so we can prune or ignore them.
NON_QUANTIFIABLE_HABITS = {
    "healthy eating",
    "organization",
    "connection",
    "gratitude",
    "kindness",
    "personal growth",
}


def _normalize(name: str) -> str:
    return str(name or "").strip().lower()


def habit_meta(name: str) -> Optional[Dict[str, object]]:
    return QUANTITATIVE_HABITS.get(_normalize(name))


def allowed_habit_names():
    return set(QUANTITATIVE_HABITS.keys())


def healthkit_habit_metas():
    return {name: meta for name, meta in QUANTITATIVE_HABITS.items() if meta.get("health_metric")}


def default_target_for_habit(name: str) -> Optional[int]:
    meta = habit_meta(name)
    target = meta.get("default_target") if meta else None
    return int(target) if target is not None else None


def default_unit_for_habit(name: str) -> Optional[str]:
    meta = habit_meta(name)
    return str(meta.get("unit")).strip() if meta and meta.get("unit") else None


def health_metric_for_habit(name: str) -> Optional[str]:
    meta = habit_meta(name)
    metric = meta.get("health_metric") if meta else None
    return str(metric) if metric else None
