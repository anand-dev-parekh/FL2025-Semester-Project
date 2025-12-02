import argparse
import os
import random
from datetime import date, timedelta
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

# Load environment files from repo root so the script can read DB creds locally.
ENV_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ENV_ROOT / ".env")
load_dotenv(ENV_ROOT / ".env.local")

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

        date_range = f"{records[-1][1].isoformat()} → {records[0][1].isoformat()}"
        print(f"✅ Upserted {len(records)} daily metrics for user {args.user_id} ({date_range}).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
