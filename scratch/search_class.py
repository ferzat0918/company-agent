import os

search_dir = r"C:\Users\lenovo\AppData\Local\Programs\Python\Python312\Lib\site-packages\wxauto"
query = "WeChatMainWndForPC"

print(f"Searching for '{query}' in {search_dir}...")
for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        if query in line:
                            print(f"{path}:{line_num}: {line.strip()}")
            except Exception as e:
                # Retry with other encoding if needed
                try:
                    with open(path, "r", encoding="gbk") as f:
                        for line_num, line in enumerate(f, 1):
                            if query in line:
                                print(f"{path}:{line_num}: {line.strip()}")
                except Exception:
                    pass
print("Search completed.")
