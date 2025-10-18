import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg2 import pool

# Load database credentials from env (allows per-machine secrets via .env/.env.local)
ENV_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ENV_ROOT / ".env")
load_dotenv(ENV_ROOT / ".env.local")

DB_NAME = os.getenv("DB_NAME", "magic_journal")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_MIN_CONN = int(os.getenv("DB_MIN_CONN", "1"))
DB_MAX_CONN = int(os.getenv("DB_MAX_CONN", "10"))

if not DB_USER or not DB_PASSWORD:
    raise RuntimeError("Database credentials missing. Set DB_USER and DB_PASSWORD in your env.")

db_pool = pool.SimpleConnectionPool(
    minconn=DB_MIN_CONN,
    maxconn=DB_MAX_CONN,
    database=DB_NAME,
    host=DB_HOST,
    user=DB_USER,
    password=DB_PASSWORD,
    port=DB_PORT,
)

if __name__ == "__main__":
    conn = db_pool.getconn()

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print("✅ Connected successfully!")
            print("PostgreSQL version:", version[0])
    except Exception as e:
        print("❌ Connection failed:", e)
    finally:
        db_pool.putconn(conn)
