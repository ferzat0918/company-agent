import os
import json
import re
import sys

# Set standard output encoding to utf-8 if possible
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

assembled_lines = {}
max_lines = 0

print("Extracting slices from all view_file and write/replace actions...")

def process_view_content(content):
    global max_lines
    
    # Verify if this view is actually for wechat_rpa_v4.py
    if "wechat_rpa_v4.py" not in content:
        return
    # If the file path shown in view content points to a different file (like page.tsx)
    file_path_match = re.search(r"File Path: `file:///([^`]+)`", content)
    if file_path_match:
        fp = file_path_match.group(1)
        if "wechat_rpa_v4.py" not in fp:
            return  # Skip if it is not our file!

    lines = content.split("\n")
    for l in lines:
        m = re.match(r"^\s*(\d+):\s?(.*)$", l)
        if m:
            line_idx = int(m.group(1))
            code_line = m.group(2)
            if "Showing lines" in code_line or "Total Lines" in code_line or "File Path" in code_line or "Created At" in code_line or "Completed At" in code_line:
                continue
            assembled_lines[line_idx] = code_line
            if line_idx > max_lines:
                max_lines = line_idx

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_idx, line in enumerate(f):
        if "wechat_rpa_v4.py" in line:
            try:
                data = json.loads(line)
                t = data.get("type")
                
                # Extract from VIEW_FILE or SYSTEM content
                if "content" in data and isinstance(data["content"], str):
                    c = data["content"]
                    process_view_content(c)
                
                # Extract from replace_file_content or write_to_file arguments in PLANNER_RESPONSE
                if "tool_calls" in data and data["tool_calls"]:
                    for tc in data["tool_calls"]:
                        args = tc.get("args", {})
                        target_file = args.get("TargetFile", "")
                        if "wechat_rpa_v4.py" in target_file:
                            # If it is a write_to_file call
                            if tc.get("name") == "write_to_file" and "CodeContent" in args:
                                print(f"Line {line_idx}: Found write_to_file with {len(args['CodeContent'])} chars")
                                code = args["CodeContent"]
                                lines = code.split("\n")
                                for i, l in enumerate(lines, 1):
                                    assembled_lines[i] = l
                                    if i > max_lines:
                                        max_lines = i
                            # If it is a replace_file_content call
                            elif tc.get("name") == "replace_file_content" and "ReplacementContent" in args:
                                start = args.get("StartLine", 1)
                                rep_code = args["ReplacementContent"]
                                print(f"Line {line_idx}: Found replace_file_content at StartLine={start} with {len(rep_code)} chars")
                                lines = rep_code.split("\n")
                                for offset, l in enumerate(lines):
                                    curr_idx = start + offset
                                    # Strip line numbers if present in the replacement content
                                    m = re.match(r"^\s*(\d+):\s?(.*)$", l)
                                    if m:
                                        l = m.group(2)
                                    assembled_lines[curr_idx] = l
                                    if curr_idx > max_lines:
                                        max_lines = curr_idx
            except Exception as e:
                pass

# Clean output messages from emojis to prevent Windows console encoding errors
print(f"Assembly complete! Max line index found: {max_lines}")
print(f"Total distinct line numbers filled: {len(assembled_lines)}")

# Find gaps
gaps = []
for i in range(1, max_lines + 1):
    if i not in assembled_lines:
        gaps.append(i)

if gaps:
    print(f"WARNING: Gaps found: {len(gaps)} lines are missing. First few gaps: {gaps[:20]}")
else:
    print("SUCCESS: Perfection! No missing lines.")

# Write the assembled output
output_path = "scratch/assembled_v4.py"
with open(output_path, "w", encoding="utf-8") as out:
    for i in range(1, max_lines + 1):
        line = assembled_lines.get(i, f"# MISSING LINE {i}")
        out.write(line + "\n")

print(f"Saved assembled script to {output_path}")
