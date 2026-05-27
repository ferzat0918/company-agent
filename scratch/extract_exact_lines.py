import os
import json

transcript_path = r"C:\Users\lenovo\.gemini\antigravity-cli\brain\82b497de-06c1-4475-9cbe-ef3b6bd2763f\.system_generated\logs\transcript_full.jsonl"

def inspect_line(line_num):
    print(f"--- Line {line_num} ---")
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for idx, line in enumerate(f):
            if idx == line_num:
                try:
                    data = json.loads(line)
                    # Recursively search for any string values and print their length and snippet
                    def search_and_save(obj, path=""):
                        if isinstance(obj, str):
                            if len(obj) > 1000:
                                print(f"Found str at {path}, length={len(obj)}, snippet={repr(obj[:100])}")
                                # Save to a file
                                safe_path = path.replace("[", "_").replace("]", "_").replace("'", "").replace(".", "_")
                                filename = f"scratch/extracted_line{line_num}_{safe_path}.py"
                                with open(filename, "w", encoding="utf-8") as out:
                                    out.write(obj)
                                print(f"  -> Saved to {filename}")
                        elif isinstance(obj, dict):
                            for k, v in obj.items():
                                search_and_save(v, f"{path}.{k}")
                        elif isinstance(obj, list):
                            for idx2, item in enumerate(obj):
                                search_and_save(item, f"{path}[{idx2}]")
                    search_and_save(data)
                except Exception as e:
                    print(f"Error parsing line {line_num}: {e}")

inspect_line(471)
inspect_line(472)
inspect_line(342)
inspect_line(430)
