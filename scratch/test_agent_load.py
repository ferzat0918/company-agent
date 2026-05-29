import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv("../.env")

print("Loading agent...")
try:
    from src.agent import agent
    print(f"Agent loaded OK: {agent}")
except Exception as e:
    print(f"FAILED to load agent: {e}")
    import traceback
    traceback.print_exc()
