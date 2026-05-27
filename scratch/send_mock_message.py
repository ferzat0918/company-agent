import time
from wxauto4 import WeChat

print("Initializing WeChat...")
wx = WeChat()
target = "文件传输助手"

print(f"Switching to chat room '{target}'...")
wx.ChatWith(target)
time.sleep(1.0)

test_prompt = "帮我绘制一个简洁红色的心形测试 SVG，并帮我转换成 PNG 格式发送给我！"
print(f"Sending test prompt: '{test_prompt}'")
wx.SendMsg(test_prompt)

print("Test prompt successfully sent! Watch the RPA daemon logs for execution...")
