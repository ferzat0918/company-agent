import os

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print(f"Inspecting raw lines in: {transcript_path}")

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            # Let's see what keys or fields are in there by looking at a snippet
            snippet = line[:200]
            print(f"Line {idx}: Length={len(line)} | Snippet: {repr(snippet)}")
