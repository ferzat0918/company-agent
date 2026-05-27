import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print(f"Scanning all matches in: {transcript_path}")

matches = []
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            matches.append((line_idx, len(line)))

matches.sort(key=lambda x: x[1], reverse=True)

print("Top 20 largest matching lines:")
for idx, (line_idx, length) in enumerate(matches[:20]):
    print(f"Candidate {idx}: Line {line_idx}, Length={length}")
