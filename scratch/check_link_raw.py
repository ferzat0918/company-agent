from wxauto4 import WeChat

def main():
    try:
        wx = WeChat()
        print("Successfully bound to WeChat!")
    except Exception as e:
        print(f"Error binding to WeChat: {e}")
        return

    try:
        msgs = wx.GetAllMessage()
        print(f"Retrieved {len(msgs)} messages.")
        link_count = 0
        for i, m in enumerate(msgs):
            m_type = getattr(m, 'type', 'Unknown')
            if m_type == 'link' or 'link' in str(type(m)).lower():
                link_count += 1
                print(f"=== Link Message #{link_count} ===")
                print(f"  Sender: {getattr(m, 'sender', 'Unknown')}")
                print(f"  Class: {type(m)}")
                print(f"  Content: {repr(getattr(m, 'content', ''))}")
                
                # Check raw
                if hasattr(m, 'raw'):
                    print(f"  raw: {repr(m.raw)}")
                
                # Check dict
                if hasattr(m, '__dict__'):
                    print(f"  __dict__: {repr(m.__dict__)}")
                    
                # Inspect UI elements inside the control
                try:
                    control = getattr(m, 'control', None)
                    if control:
                        print("  UI Automation Control Details:")
                        print(f"    Name: {repr(control.Name)}")
                        print(f"    AutomationId: {repr(control.AutomationId)}")
                        print(f"    ClassName: {repr(control.ClassName)}")
                        # Check children
                        children = control.GetChildren()
                        print(f"    Children count: {len(children)}")
                        for j, child in enumerate(children):
                            print(f"      Child #{j+1}: Name={repr(child.Name)}, ClassName={repr(child.ClassName)}")
                except Exception as ex:
                    print(f"    Failed UI inspect: {ex}")
                print("="*60)
        
        if link_count == 0:
            print("No link messages found in the active chat window. Please make sure the window with the card message is currently active and visible.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
