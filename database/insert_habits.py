import os
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

from dotenv import load_dotenv

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

HABITS = [
    ("Exercise", "Track minutes of moderate-to-vigorous movement."),
    ("Steps", "Count your daily steps to stay active."),
    ("Sleep Well", "Record minutes of quality sleep each night."),
    ("Hydration", "Measure ounces of water you drink."),
    ("Mindfulness", "Log minutes spent meditating or practicing breath work."),
    ("Learning", "Capture minutes invested in studying or reading."),
    ("Creativity", "Track minutes making art, music, or writing."),
    ("Nature Time", "Record minutes spent outdoors or walking."),
    ("Financial Awareness", "Dollars saved, invested, or budgeted intentionally."),
    ("Digital Balance", "Minutes of intentional screen-free time."),
]

def main():
    if not DB_CONFIG["user"] or not DB_CONFIG["password"]:
        raise RuntimeError("Database credentials missing. Set DB_USER and DB_PASSWORD in your env.")

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn:
            with conn.cursor() as cur:
                query = """
                    INSERT INTO habits (name, description)
                    VALUES %s
                    ON CONFLICT (name) DO NOTHING;
                """
                execute_values(cur, query, HABITS)
                print(f"✅ Inserted {len(HABITS)} general habits (skipping existing ones).")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
