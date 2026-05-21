import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
    
    serializer = JsonPlusSerializer()
    thread_id = "019e3f9b-8d90-70e3-bf1e-bd367ae340a2"
    
    print(f"Querying messages in thread: {thread_id}")
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT type, blob
                FROM checkpoint_writes
                WHERE thread_id = %s AND channel = 'messages'
                ORDER BY checkpoint_id DESC
            """, (thread_id,))
            
            rows = cur.fetchall()
            print(f"Total writes found in 'messages' channel: {len(rows)}")
            
            # Print the most recent few messages
            printed = 0
            for type_name, blob_data in rows:
                try:
                    deserialized = serializer.loads_typed((type_name, blob_data))
                    messages = deserialized if isinstance(deserialized, list) else [deserialized]
                    for msg in messages:
                        if printed >= 10:
                            break
                        role = getattr(msg, "type", "unknown")
                        content = getattr(msg, "content", "")
                        print(f"\n[{role.upper()}] (Printed {printed+1}):")
                        if isinstance(content, list):
                            for idx, block in enumerate(content):
                                print(f"  Block {idx}: type={block.get('type')}, keys={list(block.keys())}")
                                if block.get("type") == "text":
                                    print(f"    text: {block.get('text')[:300]}")
                                elif block.get("type") == "file":
                                    print(f"    file name: {block.get('metadata', {}).get('filename')}")
                                    print(f"    mimeType: {block.get('mimeType')}")
                                    print(f"    data len: {len(block.get('data', ''))}")
                        else:
                            print(f"  {str(content)[:500]}")
                        printed += 1
                except Exception as e:
                    print(f"Error deserializing: {e}")

if __name__ == "__main__":
    main()
