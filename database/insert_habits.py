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
    ("Exercise", "Engage in physical activity to strengthen body and mind."),
    ("Steps", "Track your daily step count to stay active through movement."),
    ("Healthy Eating", "Make conscious food choices that support well-being."),
    ("Hydration", "Drink enough water to stay energized and focused."),
    ("Sleep Well", "Maintain a consistent and restful sleep schedule."),
    ("Mindfulness", "Practice being present through meditation or reflection."),
    ("Learning", "Dedicate time to studying, reading, or exploring new skills."),
    ("Creativity", "Express yourself through art, writing, or creative projects."),
    ("Organization", "Plan your day, set intentions, and manage your space."),
    ("Connection", "Spend quality time nurturing relationships and community."),
    ("Gratitude", "Reflect on and appreciate positive aspects of your life."),
    ("Kindness", "Perform small acts of kindness or empathy toward others."),
    ("Nature Time", "Spend time outdoors to recharge and connect with nature."),
    ("Financial Awareness", "Track spending, saving, and long-term goals."),
    ("Digital Balance", "Limit screen time and stay mindful with technology."),
    ("Personal Growth", "Reflect on habits, values, and self-improvement."),
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
