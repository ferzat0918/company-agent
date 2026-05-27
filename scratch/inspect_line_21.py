import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for idx, line in enumerate(f):
        if idx == 21:
            data = json.loads(line)
            content = data.get("content", "")
            # Safe print to avoid Windows console errors
            safe_lines = []
            for l in content.split("\n"):
                safe_lines.append(l.encode("ascii", "ignore").decode("ascii"))
                
            print("Line 21 content length:", len(content))
            print("First 15 lines of content:")
            print("\n".join(safe_lines[:15]))
            print("...")
            print("Last 15 lines of content:")
            print("\n".join(safe_lines[-15:]))
