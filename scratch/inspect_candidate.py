import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"
line_num = 471

print(f"Reading line {line_num}...")
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if line_idx == line_num:
            data = json.loads(line)
            print(f"Keys in JSON: {list(data.keys())}")
            if "type" in data:
                print(f"Type: {data['type']}")
            if "tool_calls" in data:
                print(f"Tool calls: {len(data['tool_calls'])}")
                for tc in data['tool_calls']:
                    print(f"  Tool Name: {tc.get('name')}")
                    # Let's inspect arguments keys
                    args = tc.get("args", {})
                    print(f"  Args keys: {list(args.keys())}")
                    if "CodeContent" in args:
                        print(f"  Has CodeContent of length {len(args['CodeContent'])}")
            if "content" in data:
                print(f"Content length: {len(str(data['content']))}")
            # Save raw json to verify
            with open("scratch/inspect_471.json", "w", encoding="utf-8") as out:
                json.dump(data, out, indent=2, ensure_ascii=False)
            break
