import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

# We can read POSTGRES_URI from environment
# The URI in .env is: postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres
# In python we can format it with POSTGRES_PASSWORD
pwd = os.getenv("POSTGRES_PASSWORD", "dev-dev-dev-dev-dev-2026!!")
pg_uri = f"postgresql://postgres:{pwd}@localhost:5432/postgres"

thread_id = "10f7c7c1-3b51-511d-bd16-6afe2415028f"
print(f"Connecting to database to clear checkpoints for thread: {thread_id}...")

try:
    with psycopg.connect(pg_uri) as conn:
        with conn.cursor() as cur:
            # First, list all tables related to checkpoints
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%checkpoint%'")
            tables = [r[0] for r in cur.fetchall()]
            print("Found checkpointer tables:", tables)
            
            for table in tables:
                try:
                    # Check if thread_id column exists
                    cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' AND column_name='thread_id'")
                    has_col = bool(cur.fetchall())
                    if has_col:
                        cur.execute(f"SELECT COUNT(*) FROM {table} WHERE thread_id = %s", (thread_id,))
                        count = cur.fetchone()[0]
                        if count > 0:
                            print(f"  - Table '{table}' has {count} records for thread_id. Deleting...")
                            cur.execute(f"DELETE FROM {table} WHERE thread_id = %s", (thread_id,))
                            print(f"    ✓ Deleted from {table}")
                except Exception as tbl_err:
                    print(f"Failed to process table {table}: {tbl_err}")
            
            conn.commit()
            print("✓ Checkpoints cleared successfully! Thread is reset.")
            
except Exception as e:
    print("Database error:", e)
