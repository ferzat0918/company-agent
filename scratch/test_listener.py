from wxauto4 import WeChat
import time

wx = WeChat()
print("Starting active listener test... (Press Ctrl+C to exit)")

try:
    while True:
        sessions = wx.GetSession()
        for s in sessions:
            if s.isnew:
                print(f"✨ New message detected in [{s.name}]! Unread count: {s.new_count}")
                # Let's open the window to read messages
                wx.ChatWith(s.name)
                time.sleep(0.5)
                
                # Fetch all messages in the open chat
                msgs = wx.GetAllMessage()
                print(f"Total messages in chat: {len(msgs)}")
                
                # We can read the last few messages that are new
                # e.g., if new_count is 2, we read the last 2 messages (excluding any system messages if we want)
                new_msgs = msgs[-s.new_count:] if s.new_count > 0 else msgs[-1:]
                for m in new_msgs:
                    print(f"  - [{m.sender}] ({m.type}/{m.attr}): {m.content}")
                    
        time.sleep(2)
except KeyboardInterrupt:
    print("Listener stopped.")
