import os
import json
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

def is_metadata_line(text):
    metadata_indicators = [
        "Showing lines",
        "Total Lines",
        "File Path:",
        "Created At:",
        "Completed At:",
        "The following code has been modified",
        "The above content shows the entire",
        "The above content does NOT show",
        "Total Bytes:",
        "original_line"
    ]
    for ind in metadata_indicators:
        if ind in text:
            return True
    return False

def assemble_exact_502():
    assembled = {}
    
    # We will specifically target Line 19, 21, 23 (and 97, 99, 101) which are clean 502-line views
    target_lines_in_logs = [19, 21, 23, 97, 99, 101]
    
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for line_idx, line in enumerate(f):
            if line_idx in target_lines_in_logs:
                try:
                    data = json.loads(line)
                    c = data.get("content", "")
                    if not c:
                        continue
                        
                    m_range = re.search(r"Showing lines (\d+) to (\d+)", c)
                    if not m_range:
                        continue
                    start_line = int(m_range.group(1))
                    end_line = int(m_range.group(2))
                    
                    lines = c.split("\n")
                    for l in lines:
                        # Skip if it is raw metadata
                        if is_metadata_line(l):
                            continue
                            
                        # Use a powerful regex to parse up to two prefixes: "num1: [num2:] code"
                        # Group 1: num1, Group 2: num2 (optional), Group 3: code
                        m = re.match(r"^\s*(\d+):(?:\s*(\d+):)?\s?(.*)$", l)
                        if m:
                            num1 = int(m.group(1))
                            num2 = int(m.group(2)) if m.group(2) else None
                            code = m.group(3)
                            
                            if is_metadata_line(code):
                                continue
                                
                            abs_idx = None
                            if num2 is not None:
                                # Two prefixes: second one is ALWAYS the absolute line index
                                abs_idx = num2
                            else:
                                # One prefix: check if it falls within [start_line, end_line]
                                if start_line <= num1 <= end_line:
                                    abs_idx = num1
                                else:
                                    # It is an output line number, compute offset (usually code starts from output line 8)
                                    if num1 >= 8:
                                        abs_idx = start_line + (num1 - 8)
                            
                            if abs_idx and start_line <= abs_idx <= end_line:
                                assembled[abs_idx] = code
                except Exception as e:
                    print(f"Error parsing line {line_idx}: {e}")
                    
    # Find gaps
    gaps = []
    for i in range(1, 503):
        if i not in assembled:
            gaps.append(i)
            
    print("--- Exact 502 Lines Assembly ---")
    print(f"Distinct lines filled: {len(assembled)} / 502")
    print(f"Gaps missing: {len(gaps)}")
    if gaps:
        print(f"Gaps list (first 30): {gaps[:30]}")
        
    if len(assembled) > 0:
        out_name = "wechat_rpa_v4.py"
        with open(out_name, "w", encoding="utf-8") as out:
            for i in range(1, 503):
                out.write(assembled.get(i, "") + "\n")
        print(f"Saved assembled script to: {out_name}")

assemble_exact_502()
