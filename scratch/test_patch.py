import sys
import os
import time

# We must import wxauto's internal uiautomation first
from wxauto import wxauto
from wxauto import uiautomation as uia

print("Monkeypatching wxauto for WeChat 4.0 class...")

# Override class-level UiaAPI
wxauto.WeChat.UiaAPI = uia.WindowControl(ClassName='Qt51514QWindowIcon', searchDepth=1)

# Let's override the _show and _checkversion methods to use the new class name
def patched_show(self):
    import win32gui
    self.HWND = win32gui.FindWindow('Qt51514QWindowIcon', None)
    if not self.HWND:
         self.HWND = win32gui.FindWindow('WeChatMainWndForPC', None)
    win32gui.ShowWindow(self.HWND, 1)
    win32gui.SetWindowPos(self.HWND, -1, 0, 0, 0, 0, 3)
    win32gui.SetWindowPos(self.HWND, -2, 0, 0, 0, 0, 3)
    self.UiaAPI.SwitchToThisWindow()

wxauto.WeChat._show = patched_show

# Let's try to instantiate WeChat
try:
    print("Attempting to initialize WeChat instance...")
    wx = wxauto.WeChat()
    print("SUCCESS!")
except Exception as e:
    import traceback
    print("FAILED with exception:")
    traceback.print_exc()
