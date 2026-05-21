import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
    
    serializer = JsonPlusSerializer()
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT checkpoint_id, type, blob
                FROM checkpoint_writes
                WHERE thread_id = %s AND channel = 'messages'
                ORDER BY checkpoint_id ASC
            """, (thread_id,))
            
            rows = cur.fetchall()
            for idx, r in enumerate(rows):
                ch_id, type_name, blob_data = r
                print(f"\n--- Write {idx}: Checkpoint={ch_id}, Type={type_name} ---")
                try:
                    deserialized = serializer.loads_typed((type_name, blob_data))
                    print("  Deserialized Type:", type(deserialized))
                    if isinstance(deserialized, list):
                        print(f"  List length: {len(deserialized)}")
                        for i, item in enumerate(deserialized):
                            print(f"    Item {i}: class={item.__class__.__name__} | type={type(item)}")
                            content = getattr(item, "content", None) if hasattr(item, "content") else str(item)
                            print(f"      Content type: {type(content)}")
                            print(f"      Content: {str(content)[:600]}")
                    else:
                        print(f"  Deserialized Value: {str(deserialized)[:1000]}")
                except Exception as e:
                    print(f"  Failed to deserialize: {e}")

if __name__ == "__main__":
    main()
