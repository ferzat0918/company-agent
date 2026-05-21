import asyncio
from langgraph_sdk import get_client

async def main():
    client = get_client(url="http://localhost:2024")
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    print(f"Fetching thread {thread_id} via SDK...")
    try:
        # Get thread state
        state = await client.threads.get_state(thread_id)
        print("KEYS IN STATE:", list(state.keys()))
        values = state.get("values", {})
        print("KEYS IN VALUES:", list(values.keys()))
        messages = values.get("messages", [])
        print("MESSAGES COUNT:", len(messages))
        for idx, m in enumerate(messages):
            m_type = m.get("type", "unknown")
            print(f"\n--- Message {idx}: Type={m_type} ---")
            print(f"Content Type: {type(m.get('content'))}")
            content = m.get("content")
            if isinstance(content, str):
                print(f"Content String Snippet: {content[:300]}")
            elif isinstance(content, list):
                print(f"Content List (length {len(content)}):")
                for b_idx, b in enumerate(content):
                    print(f"  Block {b_idx}: type={type(b)}, snippet={str(b)[:300]}")
            else:
                print(f"Content Raw: {str(content)[:300]}")
    except Exception as e:
        print("Error fetching thread via SDK:", e)

if __name__ == "__main__":
    asyncio.run(main())
