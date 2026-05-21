import os
import inspect
import deepagents

print("Deepagents path:", deepagents.__file__)
print("Deepagents package contents:")
for root, dirs, files in os.walk(os.path.dirname(deepagents.__file__)):
    for file in files:
        if file.endswith(".py"):
            rel_path = os.path.relpath(os.path.join(root, file), os.path.dirname(deepagents.__file__))
            print("-", rel_path)

# Let's inspect create_deep_agent
print("\n--- create_deep_agent Source ---")
try:
    print(inspect.getsource(deepagents.create_deep_agent))
except Exception as e:
    print("Error getting source:", e)
