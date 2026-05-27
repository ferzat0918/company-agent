import os
import re
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print(f"Scanning raw lines in: {transcript_path}")

candidates = []

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            # Let's search for CodeContent strings using regex
            # We look for "CodeContent":"..." where ... is the escaped python code
            # Since the code can be very large and contains escaped quotes (\"), we use a regex that handles escaped quotes.
            # A robust way is to find the index of "CodeContent" and then find the starting " and ending "
            matches = re.finditer(r'"CodeContent"\s*:\s*"', line)
            for m in matches:
                start_idx = m.end()
                # Find the ending unescaped quote
                end_idx = start_idx
                while end_idx < len(line):
                    if line[end_idx] == '"' and line[end_idx - 1] != '\\':
                        break
                    end_idx += 1
                
                escaped_code = line[start_idx:end_idx]
                try:
                    # Wrap in JSON string and parse it to unescape
                    code = json.loads('"' + escaped_code + '"')
                    if "import " in code and "wxauto" in code and len(code) > 5000:
                        candidates.append((len(code), code, line_idx, "CodeContent"))
                except Exception as e:
                    pass

            # Also search for ReplacementContent
            matches_rep = re.finditer(r'"ReplacementContent"\s*:\s*"', line)
            for m in matches_rep:
                start_idx = m.end()
                end_idx = start_idx
                while end_idx < len(line):
                    if line[end_idx] == '"' and line[end_idx - 1] != '\\':
                        break
                    end_idx += 1
                
                escaped_code = line[start_idx:end_idx]
                try:
                    code = json.loads('"' + escaped_code + '"')
                    if "import " in code and "wxauto" in code and len(code) > 5000:
                        candidates.append((len(code), code, line_idx, "ReplacementContent"))
                except Exception as e:
                    pass

# Sort candidates by length in descending order
candidates.sort(key=lambda x: x[0], reverse=True)

print(f"Found {len(candidates)} raw code candidates:")
for idx, (length, code, line_num, field) in enumerate(candidates):
    print(f"Candidate {idx}: Length={length}, Line={line_num}, Field={field}")
    print(f"  Preview: {repr(code[:150])}")
    
    # Save candidates
    out_path = f"scratch/raw_candidate_{idx}_len{length}_line{line_num}.py"
    with open(out_path, "w", encoding="utf-8") as out:
        out.write(code)
    print(f"  -> Saved to {out_path}")
