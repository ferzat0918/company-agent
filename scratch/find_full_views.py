import os
import json
import re

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

print("Searching for complete view_file spans...")

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            try:
                data = json.loads(line)
                if "content" in data and isinstance(data["content"], str):
                    c = data["content"]
                    if "Showing lines 1 to" in c and "wechat_rpa_v4.py" in c:
                        # Find the showing lines range
                        m = re.search(r"Showing lines (\d+) to (\d+)", c)
                        total_lines = re.search(r"Total Lines: (\d+)", c)
                        tot = total_lines.group(1) if total_lines else "unknown"
                        print(f"Line {line_idx}: Found view of lines 1 to {m.group(2)} of {tot} lines!")
                        
                        # Save this to a candidate file!
                        # We must strip the leading system headings (first 7 lines usually)
                        # And strip the line number prefixes (like "8: import os" -> "import os")
                        raw_lines = c.split("\n")
                        code_lines = []
                        start_processing = False
                        
                        for rl in raw_lines:
                            # Detect the start of the code
                            # The instructions say: "The following code has been modified..."
                            # And the next lines are the actual code with prefixes
                            if "The following code has been modified" in rl:
                                start_processing = True
                                continue
                            
                            if start_processing:
                                # Strip line number prefix
                                # Wait, the prefix added by system is like "8: import os"
                                # We can use regex to strip it
                                m_prefix = re.match(r"^\s*\d+:\s?(.*)$", rl)
                                if m_prefix:
                                    code_lines.append(m_prefix.group(1))
                                else:
                                    # If it doesn't match but we are in processing, keep it (like footers or empty lines)
                                    if "The above content shows the entire" in rl or "The above content does NOT show" in rl:
                                        break
                                    code_lines.append(rl)
                        
                        full_code = "\n".join(code_lines)
                        out_path = f"scratch/restored_full_view_line{line_idx}.py"
                        with open(out_path, "w", encoding="utf-8") as out:
                            out.write(full_code)
                        print(f"  -> Extracted & saved to {out_path} (Length: {len(full_code)} chars)")
            except Exception as e:
                print(f"Error at line {line_idx}: {e}")
