from wxauto import uiautomation as uia

wechat_win = uia.WindowControl(ClassName='Qt51514QWindowIcon')
if wechat_win.Exists(3):
    print("Found WeChat 4.0 window!")
    children = wechat_win.GetChildren()
    
    for idx, child in enumerate(children):
        print(f"\n--- Child {idx}: Name='{child.Name}', Class='{child.ClassName}' ---")
        sub_children = child.GetChildren()
        print(f"Total sub-children: {len(sub_children)}")
        for s_idx, s_child in enumerate(sub_children):
            print(f"  Sub-child {s_idx}: Name='{s_child.Name}', Class='{s_child.ClassName}', Type='{s_child.ControlTypeName}'")
            ss_children = s_child.GetChildren()
            print(f"    Total grandchild: {len(ss_children)}")
            for ss_idx, ss_child in enumerate(ss_children):
                print(f"      Grandchild {ss_idx}: Name='{ss_child.Name}', Class='{ss_child.ClassName}', Type='{ss_child.ControlTypeName}'")
else:
    print("WeChat 4.0 window NOT found.")
