import os
import json
import re

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

def extract_strings_from_json(obj):
    results = []
    if isinstance(obj, str):
        if "WeChat PC 4.x RPA" in obj or "sync_supabase_settings_loop" in obj:
            results.append(obj)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            results.extend(extract_strings_from_json(v))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(extract_strings_from_json(item))
    return results

print(f"Scanning for candidates in {transcript_path}...")
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line or "WeChat PC" in line:
            try:
                data = json.loads(line)
                extracted = extract_strings_from_json(data)
                for i, text in enumerate(extracted):
                    # Clean up possible line numbers
                    lines = text.split("\n")
                    cleaned_lines = []
                    has_line_numbers = False
                    for l in lines:
                        m = re.match(r"^\s*\d+:\s?(.*)$", l)
                        if m:
                            cleaned_lines.append(m.group(1))
                            has_line_numbers = True
                        else:
                            cleaned_lines.append(l)
                    cleaned_text = "\n".join(cleaned_lines)
                    
                    # Check if it looks like a complete file (has import statements and main func)
                    is_complete = "import " in cleaned_text and "def main():" in cleaned_text
                    
                    print(f"Line {line_idx}, Candidate {i}: RawLen={len(text)}, CleanedLen={len(cleaned_text)}, HasLineNums={has_line_numbers}, IsComplete={is_complete}")
                    
                    # If it's a promising complete script, write it to a distinct file
                    if is_complete and len(cleaned_text) > 15000:
                        out_name = f"scratch/candidate_line{line_idx}_cand{i}.py"
                        with open(out_name, "w", encoding="utf-8") as out:
                            out.write(cleaned_text)
                        print(f"  -> Saved as {out_name}")
            except Exception as e:
                print(f"Line {line_idx} error: {e}")
                pass
