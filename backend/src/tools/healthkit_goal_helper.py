from tools.habit_meta import health_metric_for_habit, healthkit_habit_metas

HEALTHKIT_HABIT_METAS = healthkit_habit_metas()
HEALTHKIT_HABIT_METRICS = {
    name: {"metric": meta["health_metric"], "unit": meta["unit"]}
    for name, meta in HEALTHKIT_HABIT_METAS.items()
}
HEALTH_METRIC_KEYS = {meta["metric"] for meta in HEALTHKIT_HABIT_METRICS.values()}
METRIC_UNITS = {meta["metric"]: meta["unit"] for meta in HEALTHKIT_HABIT_METRICS.values()}
HEALTHKIT_DEFAULT_TARGETS = {}
for name, meta in HEALTHKIT_HABIT_METRICS.items():
    habit_meta = HEALTHKIT_HABIT_METAS.get(name, {}) or {}
    default_target = habit_meta.get("default_target")
    if default_target is not None:
        HEALTHKIT_DEFAULT_TARGETS[meta["metric"]] = int(default_target)


def metric_for_habit_name(habit_name: str):
    """Return the HealthKit metric key for a habit name, if it is HealthKit-backed."""
    return health_metric_for_habit(habit_name)


def metric_unit(metric_key: str):
    key = str(metric_key or "").strip().lower()
    return METRIC_UNITS.get(key)


def calculate_health_xp(actual_value: int | float | None, target_value: int | float | None):
    """
    Translate a numeric metric into XP and completion level using a linear scale.
      - 100%+ of target: 10 XP (complete)
      - anything below target: XP scales linearly up to 10
      - missing/invalid values: 0 XP (missed)
    """
    if target_value is None or target_value <= 0 or actual_value is None:
        return 0, "missed", 0.0

    try:
        ratio = float(actual_value) / float(target_value)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0, "missed", 0.0

    clamped_ratio = max(0.0, ratio)
    xp = min(10, int((clamped_ratio * 10) + 0.5))
    if clamped_ratio >= 1.0:
        return xp, "complete", clamped_ratio
    if clamped_ratio > 0:
        return xp, "partial", clamped_ratio
    return xp, "missed", clamped_ratio
