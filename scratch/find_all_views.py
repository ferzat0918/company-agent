import os
import json
import re

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print(f"Scanning view_file responses in: {transcript_path}")

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            try:
                data = json.loads(line)
                t = data.get("type")
                
                # Check for VIEW_FILE or SYSTEM results that show code
                content = None
                if t == "VIEW_FILE" and "content" in data:
                    content = data["content"]
                elif "content" in data and isinstance(data["content"], str) and "wechat_rpa_v4.py" in data["content"]:
                    content = data["content"]
                
                if content:
                    # Search for line range like "Showing lines X to Y"
                    m = re.search(r"Showing lines (\d+) to (\d+)", content)
                    total_lines_match = re.search(r"Total Lines: (\d+)", content)
                    total_bytes_match = re.search(r"Total Bytes: (\d+)", content)
                    
                    if m:
                        start_line = m.group(1)
                        end_line = m.group(2)
                        tot_lines = total_lines_match.group(1) if total_lines_match else "unknown"
                        tot_bytes = total_bytes_match.group(1) if total_bytes_match else "unknown"
                        print(f"Line {line_idx}: View range {start_line}-{end_line} of {tot_lines} lines (Total bytes: {tot_bytes}), type={t}")
                    else:
                        print(f"Line {line_idx}: Has content matching v4 but no range found. Length={len(content)}, type={t}")
            except Exception as e:
                pass
