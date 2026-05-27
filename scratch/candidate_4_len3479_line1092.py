import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"
output_path = r"C:\Users\lenovo\company-agent\wechat_rpa_v4.py"

print(f"Opening transcript file: {transcript_path}")
if not os.path.exists(transcript_path):
    print("Error: transcript file not found!")
    sys.exit(1)

best_match = None
max_length = 0

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "WeChat PC 4.x RPA" in line or "sync_supabase_settings_loop" in line:
            try:
                data = json.loads(line)
                # Check for files content or command content or tool outputs
                content_str = json.dumps(data)
                
                # We search for long code content of python
                # Especially we look for code starting with python imports or comments
                # Let's search inside the json recursively for strings that look like our python script
                def extract_strings(obj):
                    nonlocal best_match, max_length
                    if isinstance(obj, str):
                        if "WeChat PC 4.x RPA" in obj and "def main()" in obj and len(obj) > max_length:
                            max_length = len(obj)
                            best_match = obj
                    elif isinstance(obj, dict):
                        for k, v in obj.items():
                            extract_strings(v)
                    elif isinstance(obj, list):
                        for item in obj:
                            extract_strings(item)
                
                extract_strings(data)
            except Exception as e:
                pass

if best_match:
    print(f"Success! Found matching Python script of length: {len(best_match)}")
    # Clean up line numbers if they were added (e.g. "170: import os" or "170:  import os" or similar from view_file formatting)
    lines = best_match.split("\n")
    cleaned_lines = []
    for line in lines:
        # Strip line numbers like "170: " or "170:  " or "123:   "
        import re
        m = re.match(r"^\s*\d+:\s?(.*)$", line)
        if m:
            cleaned_lines.append(m.group(1))
        else:
            cleaned_lines.append(line)
            
    restored_code = "\n".join(cleaned_lines)
    
    # Write to output file
    with open(output_path, "w", encoding="utf-8") as out:
        out.write(restored_code)
    print(f"Restored code written successfully to: {output_path}")
else:
    print("Could not find full matching script inside the transcript. Let's do a broader search.")
    # Broader search for blocks containing import statements and wxauto
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for idx, line in enumerate(f):
            if "wxauto" in line and "threading" in line and len(line) > 10000:
                print(f"Found line {idx} with large content containing wxauto")
                try:
                    data = json.loads(line)
                    # Dump string for manual inspection
                    with open("scratch/recovered_raw.txt", "w", encoding="utf-8") as raw:
                        raw.write(json.dumps(data, indent=2, ensure_ascii=False))
                    print("Dumped raw search JSON to scratch/recovered_raw.txt")
                except:
                    pass
