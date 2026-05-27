import os
import sys
import psycopg
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

def main():
    serializer = JsonPlusSerializer()
    thread_id = '10f7c7c1-3b51-511d-bd16-6afe2415028f'
    db_uri = 'postgresql://postgres:dev-dev-dev-dev-dev-2026!!@localhost:5432/postgres'
    
    print(f"Querying messages in thread: {thread_id}")
    with psycopg.connect(db_uri) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT type, blob
                FROM checkpoint_writes
                WHERE thread_id = %s AND channel = 'messages'
                ORDER BY checkpoint_id DESC
            """, (thread_id,))
            
            rows = cur.fetchall()
            print(f"Total writes found in 'messages' channel: {len(rows)}")
            
            printed = 0
            for type_name, blob_data in rows:
                try:
                    deserialized = serializer.loads_typed((type_name, blob_data))
                    messages = deserialized if isinstance(deserialized, list) else [deserialized]
                    for msg in messages:
                        if printed >= 15:
                            break
                        role = getattr(msg, "type", "unknown")
                        content = getattr(msg, "content", "")
                        tool_calls = getattr(msg, "tool_calls", [])
                        print(f"\n--- MESSAGE {printed+1} [{role.upper()}] ---")
                        print(f"Content: {str(content)[:400]}")
                        if tool_calls:
                            print(f"Tool Calls: {tool_calls}")
                        printed += 1
                except Exception as e:
                    print(f"Error deserializing: {e}")

if __name__ == '__main__':
    main()
