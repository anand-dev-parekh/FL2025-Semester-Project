HEALTHKIT_HABIT_METRICS = {
    "exercise": {"metric": "exercise_minutes", "unit": "minutes"},
    "sleep well": {"metric": "sleep_minutes", "unit": "minutes"},
    "steps": {"metric": "steps", "unit": "steps"},
}

HEALTH_METRIC_KEYS = {"steps", "exercise_minutes", "sleep_minutes"}


def metric_for_habit_name(habit_name: str):
    """Return the HealthKit metric key for a habit name, if it is HealthKit-backed."""
    if not habit_name:
        return None
    key = str(habit_name).strip().lower()
    match = HEALTHKIT_HABIT_METRICS.get(key)
    return match["metric"] if match else None


def metric_unit(metric_key: str):
    key = str(metric_key or "").strip().lower()
    for meta in HEALTHKIT_HABIT_METRICS.values():
        if meta["metric"] == key:
            return meta["unit"]
    return None


def calculate_health_xp(actual_value: int | float | None, target_value: int | float | None):
    """
    Translate a numeric HealthKit metric into XP and completion level.
    We use simple thresholds:
      - 100%+ of target: 10 XP (complete)
      - 80-99%: 7 XP (partial)
      - 50-79%: 4 XP (partial)
      - below 50% or no target: 0 XP (missed)
    """
    if target_value is None or target_value <= 0 or actual_value is None:
        return 0, "missed", 0.0

    try:
        ratio = float(actual_value) / float(target_value)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0, "missed", 0.0

    if ratio >= 1.0:
        return 10, "complete", ratio
    if ratio >= 0.8:
        return 7, "partial", ratio
    if ratio >= 0.5:
        return 4, "partial", ratio
    return 0, "missed", ratio
