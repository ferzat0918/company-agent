import psycopg
import json

try:
    # Use postgres container name as host
    conn = psycopg.connect('postgresql://postgres:dev-dev-dev-dev-dev-2026!!@postgres:5432/postgres')
    cur = conn.cursor()
    cur.execute("""
        SELECT metadata 
        FROM checkpoints 
        WHERE thread_id = '10f7c7c1-3b51-511d-bd16-6afe2415028f' 
        ORDER BY checkpoint_id DESC 
        LIMIT 5
    """)
    rows = cur.fetchall()
    print(f"Found {len(rows)} checkpoints.")
    for idx, r in enumerate(rows):
        print(f"\n--- Checkpoint {idx} Metadata ---")
        meta = r[0]
        if isinstance(meta, str):
            meta = json.loads(meta)
        print(json.dumps(meta, indent=2, ensure_ascii=False))
except Exception as e:
    print("Database error:", e)
