import sys
from wxauto4 import WeChat

def main():
    try:
        wx = WeChat()
        print("Successfully bound to WeChat!")
    except Exception as e:
        print(f"Error binding to WeChat: {e}")
        return

    # Get active session messages
    try:
        msgs = wx.GetAllMessage()
        print(f"Retrieved {len(msgs)} messages in current active chat:")
        print("="*60)
        for i, m in enumerate(msgs[-10:]):
            print(f"Msg #{i+1}:")
            print(f"  Sender: {getattr(m, 'sender', 'Unknown')}")
            print(f"  Attr/Type: {getattr(m, 'attr', 'Unknown')} / {getattr(m, 'type', 'Unknown')}")
            print(f"  Content: {repr(getattr(m, 'content', ''))}")
            # Check other attributes if any
            extra_attrs = [a for a in dir(m) if not a.startswith('_') and a not in ['sender', 'attr', 'type', 'content']]
            if extra_attrs:
                print(f"  Extra Attributes:")
                for attr in extra_attrs:
                    try:
                        print(f"    - {attr}: {repr(getattr(m, attr))}")
                    except Exception:
                        pass
            print("-"*60)
    except Exception as e:
        print(f"Error getting messages: {e}")

if __name__ == "__main__":
    main()
