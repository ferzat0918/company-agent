import os
import json
import re

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print("Searching for 502-line view spans...")

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            try:
                data = json.loads(line)
                if "content" in data and isinstance(data["content"], str):
                    c = data["content"]
                    if "wechat_rpa_v4.py" in c and "Total Lines: 502" in c:
                        # Find the showing lines range
                        m = re.search(r"Showing lines (\d+) to (\d+)", c)
                        if m:
                            print(f"Line {line_idx}: View of lines {m.group(1)} to {m.group(2)} of 502 lines!")
            except Exception:
                pass
