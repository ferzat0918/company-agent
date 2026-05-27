from wxauto4 import WeChat
import time

wx = WeChat()
print("Getting sessions...")
sessions = wx.GetSession()
print(f"Total sessions found: {len(sessions)}")

for idx, s in enumerate(sessions):
    print(f"\nSession {idx}:")
    print("  - Type of session:", type(s))
    print("  - Attributes/Properties:")
    for attr in dir(s):
        if not attr.startswith("_"):
            try:
                val = getattr(s, attr)
                # Avoid printing methods, only print properties/fields
                if not callable(val):
                    print(f"    - {attr}: {val}")
            except Exception as e:
                print(f"    - {attr}: Error reading: {e}")
