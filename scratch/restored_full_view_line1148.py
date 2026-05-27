import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print(f"Scanning transcript: {transcript_path}")
if not os.path.exists(transcript_path):
    print("Not found!")
    sys.exit(1)

matches = []
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            matches.append((line_idx, len(line)))

print(f"Found {len(matches)} lines matching 'wechat_rpa_v4.py':")
for line_idx, length in matches[:20]:
    print(f"Line {line_idx}: Length={length}")
