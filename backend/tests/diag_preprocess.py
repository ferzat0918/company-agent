import os
import sys
import base64
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.agent import agent
from langchain_core.messages import HumanMessage

async def async_main():
    print("--- Async Diagnostic starting ---")
    
    # Clean up previous debug log if it exists
    debug_path = "/tmp/preprocess_debug.txt"
    if os.path.exists(debug_path):
        os.remove(debug_path)
        print("Cleared existing debug log.")
        
    raw_text = "This is the content of the uploaded plain text file."
    raw_base64 = base64.b64encode(raw_text.encode("utf-8")).decode("utf-8")
    
    msg = HumanMessage(
        content=[
            {"type": "text", "text": "Hello, please summarize the contents of this text file:"},
            {
                "type": "file",
                "mimeType": "text/plain",
                "data": raw_base64,
                "metadata": {"filename": "test_memo.txt"}
            }
        ]
    )
    
    print("Invoking agent asynchronously...")
    try:
        # We run the agent. We pass a thread_id config to allow persistence
        config = {"configurable": {"thread_id": "test-diag-thread"}}
        response = await agent.ainvoke({"messages": [msg]}, config=config)
        print("\nAgent response keys:", response.keys())
        last_msg = response["messages"][-1]
        print("\nLast message from agent:")
        print(f"Role: {last_msg.type if hasattr(last_msg, 'type') else type(last_msg)}")
        print(f"Content: {getattr(last_msg, 'content', '')[:1000]}")
    except Exception as e:
        print("\nException raised during invoke:", e)
        import traceback
        traceback.print_exc()
        
    print("\n--- Reading /tmp/preprocess_debug.txt ---")
    if os.path.exists(debug_path):
        with open(debug_path, "r", encoding="utf-8") as f:
            print(f.read())
    else:
        print("Debug log file does not exist!")

if __name__ == "__main__":
    asyncio.run(async_main())
