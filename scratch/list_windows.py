import win32gui
import win32process
import psutil

def winEnumHandler(hwnd, ctx):
    if win32gui.IsWindowVisible(hwnd):
        title = win32gui.GetWindowText(hwnd)
        class_name = win32gui.GetClassName(hwnd)
        if title or class_name:
            # Check process name if possible
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                proc = psutil.Process(pid)
                proc_name = proc.name()
            except Exception:
                proc_name = "Unknown"
            
            if "wechat" in title.lower() or "weixin" in title.lower() or "wechat" in class_name.lower() or "weixin" in class_name.lower() or "wechat" in proc_name.lower() or "weixin" in proc_name.lower() or "qt5" in class_name.lower():
                print(f"HWND: {hwnd} | Title: {title} | Class: {class_name} | Process: {proc_name} (PID: {pid})")

print("Scanning for WeChat/Weixin windows...")
win32gui.EnumWindows(winEnumHandler, None)
print("Scan completed.")
