from psycopg2 import pool

db_pool = pool.SimpleConnectionPool(
                        minconn=1,  # minimum connections
                        maxconn=10, # maximum connections
                        database="magic_journal",
                        host="localhost",
                        user="anandparekh",
                        password="Jaylaxmi1",
                        port="5432"
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
