import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print(f"Scanning transcript: {transcript_path}")
if not os.path.exists(transcript_path):
    print("Not found!")
    exit(1)

matches = []
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            matches.append((line_idx, len(line), line))

print(f"Found {len(matches)} lines matching 'wechat_rpa_v4.py':")
for line_idx, length, raw_line in matches:
    try:
        data = json.loads(raw_line)
        t = data.get("type", "UNKNOWN")
        source = data.get("source", "UNKNOWN")
        tc_names = []
        if "tool_calls" in data and data["tool_calls"]:
            for tc in data["tool_calls"]:
                tc_names.append(tc.get("name", "anon"))
        
        # Only print write_to_file, replace_file_content, or other interesting types
        # OR if the length is very large
        if "write_to_file" in tc_names or "replace_file_content" in tc_names or length > 10000 or t in ["CODE_ACTION", "CHECKPOINT"]:
            print(f"Line {line_idx}: Length={length}, Type={t}, Source={source}, Tools={tc_names}")
    except Exception as e:
        pass
