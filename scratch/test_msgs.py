from wxauto4 import WeChat
import time

wx = WeChat()
print("Please open the target chat window on WeChat PC...")
time.sleep(3)

print("Fetching all messages in the current window...")
msgs = wx.GetAllMessage()
print(f"Total messages fetched: {len(msgs)}")

for idx, m in enumerate(msgs):
    print(f"\nMessage {idx}:")
    print(f"  - type: {m.type} (Type: {type(m.type)})")
    print(f"  - attr: {m.attr} (Type: {type(m.attr)})")
    print(f"  - sender: '{m.sender}' (Type: {type(m.sender)})")
    print(f"  - content: '{m.content}' (Type: {type(m.content)})")
    print(f"  - class: {m.__class__.__name__}")
