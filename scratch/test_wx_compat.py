from wxauto import uiautomation as uia

wechat_win = uia.WindowControl(ClassName='Qt51514QWindowIcon')
if wechat_win.Exists(3):
    print("WeChat 4.0 window found.")
    children = wechat_win.GetChildren()
    print(f"Total children: {len(children)}")
    for i, child in enumerate(children):
        print(f"Child {i}: Name='{child.Name}', ClassName='{child.ClassName}'")
        
    print("\nLooking for children without class name:")
    no_class_children = [i for i in children if not i.ClassName]
    print(f"Count: {len(no_class_children)}")
else:
    print("WeChat 4.0 window not found.")
