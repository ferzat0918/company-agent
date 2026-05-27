import os
import json
import re

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

def clean_lines(text):
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        m = re.match(r"^\s*\d+:\s?(.*)$", line)
        if m:
            cleaned_lines.append(m.group(1))
        else:
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines)

candidates = []

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wxauto" in line:
            try:
                data = json.loads(line)
                def extract_strings(obj):
                    if isinstance(obj, str):
                        if "import " in obj and ("wxauto" in obj or "WeChat" in obj) and len(obj) > 3000:
                            cleaned = clean_lines(obj)
                            # Check if it has key rpa components
                            if "def main" in cleaned or "def " in cleaned:
                                candidates.append((len(cleaned), cleaned, line_idx))
                    elif isinstance(obj, dict):
                        for v in obj.values():
                            extract_strings(v)
                    elif isinstance(obj, list):
                        for item in obj:
                            extract_strings(item)
                extract_strings(data)
            except Exception as e:
                pass

# Sort candidates by length in descending order
candidates.sort(key=lambda x: x[0], reverse=True)

print(f"Total candidates found: {len(candidates)}")
for idx, (length, code, line_num) in enumerate(candidates[:15]):
    print(f"Candidate {idx}: Length={length}, Line={line_num}")
    preview = code[:150].replace('\n', ' ')
    print(f"  Preview: {preview}...")
    
    # Save each candidate to a separate file to inspect
    out_file = f"scratch/candidate_{idx}_len{length}_line{line_num}.py"
    with open(out_file, "w", encoding="utf-8") as out:
        out.write(code)
    print(f"  -> Saved to {out_file}")
