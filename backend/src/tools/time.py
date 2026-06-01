import datetime
from langchain_core.tools import tool

@tool
def get_current_time() -> str:
    """获取当前系统的准确本地日期 and 时间（北京时间 CST, UTC+8）。
    
    当用户询问与当前时间、今天、昨天、明天相关的时效性问题，或者需要查询最新新闻时，
    你必须首先调用此工具以获取准确的本地日期和时间，以便为搜索工具提供正确的日期背景。
    """
    # 强制使用北京时间 (UTC+8)，解决 Docker 容器内部默认 UTC 时间与宿主机存在 8 小时时差的问题
    tz_beijing = datetime.timezone(datetime.timedelta(hours=8))
    now = datetime.datetime.now(tz_beijing)
    weekday_map = {0: "星期一", 1: "星期二", 2: "星期三", 3: "星期四", 4: "星期五", 5: "星期六", 6: "星期日"}
    weekday_str = weekday_map.get(now.weekday(), "")
    return now.strftime(f"当前系统时间为: %Y-%m-%d %H:%M:%S ({weekday_str})")
