import argparse
import os
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

# Load environment files from repo root so the script can read DB creds locally.
ENV_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ENV_ROOT / ".env")
load_dotenv(ENV_ROOT / ".env.local")

# Allow importing helpers from the backend (for XP logic parity).
BACKEND_SRC = ENV_ROOT / "Backend" / "src"
if BACKEND_SRC.exists():
    sys.path.append(str(BACKEND_SRC))
try:
    from tools.healthkit_goal_helper import (
        calculate_health_xp,
        metric_unit,
        HEALTH_METRIC_KEYS,
    )
except Exception:  # pragma: no cover - fallback for missing backend path
    def calculate_health_xp(actual_value, target_value):
        if target_value is None or target_value <= 0 or actual_value is None:
            return 0, "missed", 0.0
        ratio = float(actual_value) / float(target_value)
        if ratio >= 1.0:
            return 10, "complete", ratio
        if ratio >= 0.8:
            return 7, "partial", ratio
        if ratio >= 0.5:
            return 4, "partial", ratio
        return 0, "missed", ratio

    def metric_unit(metric_key):
        return None

    HEALTH_METRIC_KEYS = {"steps", "exercise_minutes", "sleep_minutes"}

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "magic_journal"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
}

SOURCE = "healthkit_seed"


def fake_healthkit_records(user_id: int, days: int) -> list[tuple]:
    """Create simple-but-plausible daily metrics for the requested window."""
    today = date.today()
    records = []
    for offset in range(days):
        metric_date = today - timedelta(days=offset)
        steps = random.randint(4500, 13000)
        exercise_minutes = max(10, min(120, steps // 110 + random.randint(-8, 12)))
        sleep_minutes = random.randint(360, 520)
        records.append((user_id, metric_date, steps, exercise_minutes, sleep_minutes, SOURCE))
    return records


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed a week's worth of fake HealthKit data for a user."
    )
    parser.add_argument("user_id", type=int, help="ID of the target user in the database")
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="How many recent days to generate (default: 7, max: 30)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed to make the generated values deterministic",
    )
    return parser.parse_args()


def sync_healthkit_goals(conn, user_id: int, records: list[tuple]):
    """Upsert journal entries and goal XP based on the health data just seeded."""
    if not records:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, health_metric, target_value, target_unit
            FROM goals
            WHERE user_id = %s
              AND uses_healthkit = TRUE
              AND health_metric IS NOT NULL
              AND target_value IS NOT NULL
            """,
            (user_id,),
        )
        goal_rows = cur.fetchall()

    goals = [
        {
            "id": row[0],
            "health_metric": row[1],
            "target_value": row[2],
            "target_unit": row[3],
        }
        for row in goal_rows
        if row[1] in HEALTH_METRIC_KEYS
    ]
    if not goals:
        return

    for record in records:
        # Records may be (user_id, date, steps, exercise_minutes, sleep_minutes, source)
        # or without user_id if passed directly.
        if len(record) == 6:
            _, metric_date, steps, exercise_minutes, sleep_minutes, source = record
        elif len(record) == 5:
            metric_date, steps, exercise_minutes, sleep_minutes, source = record
        else:
            raise ValueError(f"Unexpected record shape: {record}")
        metrics = {
            "steps": steps,
            "exercise_minutes": exercise_minutes,
            "sleep_minutes": sleep_minutes,
        }
        for goal in goals:
            metric_key = goal["health_metric"]
            actual_value = metrics.get(metric_key)
            xp_delta, completion_level, _ = calculate_health_xp(actual_value, goal["target_value"])
            auto_note = (
                f"Auto-tracked from HealthKit: {actual_value} {metric_unit(metric_key) or ''} "
                f"toward a goal of {goal['target_value']} {goal['target_unit'] or metric_unit(metric_key) or ''}."
            ).strip()

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, xp_delta, reflection
                    FROM journal_entries
                    WHERE user_id = %s AND goal_id = %s AND entry_date = %s
                    FOR UPDATE
                    """,
                    (user_id, goal["id"], metric_date),
                )
                existing = cur.fetchone()

                xp_diff = xp_delta
                entry_id = None
                if existing:
                    entry_id = existing[0]
                    prev_xp = existing[1] or 0
                    xp_diff = xp_delta - prev_xp
                    reflection = existing[2] or auto_note
                    cur.execute(
                        """
                        UPDATE journal_entries
                        SET reflection = %s,
                            xp_delta = %s,
                            completion_level = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (reflection, xp_delta, completion_level, entry_id),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO journal_entries (user_id, goal_id, entry_date, reflection, xp_delta, completion_level)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (user_id, goal["id"], metric_date, auto_note, xp_delta, completion_level),
                    )
                    entry_id = cur.fetchone()[0]

                cur.execute(
                    """
                    UPDATE goals
                    SET xp = GREATEST(0, xp + %s)
                    WHERE id = %s AND user_id = %s
                    """,
                    (xp_diff, goal["id"], user_id),
                )


def main() -> None:
    args = parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    days = max(1, min(args.days, 30))
    if not DB_CONFIG["user"] or not DB_CONFIG["password"]:
        raise RuntimeError("Database credentials missing. Set DB_USER and DB_PASSWORD in your env.")

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM users WHERE id = %s", (args.user_id,))
                if cur.fetchone() is None:
                    raise SystemExit(f"User id {args.user_id} not found in users table.")

                records = fake_healthkit_records(args.user_id, days)
                query = """
                    INSERT INTO user_health_metrics (user_id, metric_date, steps, exercise_minutes, sleep_minutes, source)
                    VALUES %s
                    ON CONFLICT (user_id, metric_date)
                    DO UPDATE SET
                        steps = EXCLUDED.steps,
                        exercise_minutes = EXCLUDED.exercise_minutes,
                        sleep_minutes = EXCLUDED.sleep_minutes,
                        source = EXCLUDED.source,
                        updated_at = now();
                """
                execute_values(cur, query, records)

            # Sync goals and journal entries based on the new health data
            sync_healthkit_goals(conn, args.user_id, records)

        date_range = f"{records[-1][1].isoformat()} → {records[0][1].isoformat()}"
        print(f"✅ Upserted {len(records)} daily metrics for user {args.user_id} ({date_range}).")
        print("✅ Journal entries and goal XP updated for HealthKit-backed goals.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
