import os
import json
import datetime
import psycopg
from typing import Literal
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from apscheduler.triggers.cron import CronTrigger
from src.config import POSTGRES_URI

@tool
def schedule_agent_task(
    task_description: str,
    time_spec: str,
    task_type: Literal["one-shot", "cron"],
    context_data: dict = None,
    config: RunnableConfig = None
) -> str:
    """制订一个自动化的定时任务。时间到达时，系统会唤醒一个专属的执行智能体（Task Executor Agent）
    在后台为你去执行该任务并自动调用各类工具。
    
    你必须写明极其详细的任务执行说明书，告诉未来的执行 Agent 具体的任务步骤、需要调用什么工具（如 send_wechat_file 微信通道）、将结果发送到哪里。
    
    Args:
        task_description: 极其详细的任务说明书（如：在明天下午6点，利用 Python 沙盒分析销售数据并生成 PDF 图表，最后将文件通过微信通道发送给微信联系人 [张三]）。
        time_spec: 触发时间规格。One-shot 传入延迟的秒数（如 "60" 表示 60 秒后）；Cron 传入 5 位 Cron 表达式（如 "0 9 * * 1-5" 表示工作日早 9 点）。
        task_type: "one-shot" (单次延时) 或 "cron" (周期重复)
        context_data: 留给未来执行 Agent 运用的静态变量字典（如 {"chat_name": "张三", "email": "boss@company.com", "channel": "wechat"}）
    """
    if not task_description:
        return "错误：任务描述（task_description）不能为空。"
    if not time_spec:
        return "错误：触发时间规格（time_spec）不能为空。"
        
    # 1. 提取当前对话线程与身份上下文
    thread_id = "default"
    user_id = "d81a0391-2663-4f0b-ba89-39f17773a9a1" # 默认 fallback (Freddy)
    current_channel = "web"
    current_chat_name = "系统会话"
    current_sender = "系统"
    
    if config and isinstance(config, dict):
        configurable = config.get("configurable", {})
        metadata = config.get("metadata", {})
        
        thread_id = configurable.get("thread_id") or metadata.get("thread_id") or "default"
        # 依次从 configurable 或 metadata 寻找归属人 ID
        user_id = (
            configurable.get("owner") or 
            metadata.get("owner") or 
            configurable.get("user_id") or 
            metadata.get("user_id") or 
            user_id
        )
        
        # 获取渠道与联系人名字
        current_channel = configurable.get("channel") or metadata.get("channel") or current_channel
        current_chat_name = configurable.get("chat_name") or metadata.get("chat_name") or current_chat_name
        current_sender = configurable.get("sender") or metadata.get("sender") or current_sender

    # 2. 格式化静态上下文参数
    ctx = {}
    if context_data and isinstance(context_data, dict):
        ctx.update(context_data)
    
    # 自动继承渠道和联系人名字，确保执行时知道往哪推送
    ctx.setdefault("channel", current_channel)
    ctx.setdefault("chat_name", current_chat_name)
    ctx.setdefault("sender", current_sender)

    # 3. 计算首次触发的物理时间 next_run_at (统一采用 UTC 时区计算和存储)
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    try:
        if task_type == "one-shot":
            delay_seconds = int(time_spec)
            next_run_at = now_utc + datetime.timedelta(seconds=delay_seconds)
        elif task_type == "cron":
            trigger = CronTrigger.from_crontab(time_spec, timezone=datetime.timezone.utc)
            next_run_at = trigger.get_next_fire_time(None, now_utc)
            if next_run_at is None:
                raise ValueError("计算出的下一次 Cron 触发时间为空，请检查 Cron 表达式的合法性")
        else:
            return f"错误：未知的任务类型 '{task_type}'"
    except Exception as e:
        return f"错误：时间规格解析失败 - {str(e)}"

    # 4. 直连 Postgres 写入任务登记表
    try:
        # 同步连接写入，任务表 Grant 给了 authenticated & anon 拥有全部权限
        with psycopg.connect(POSTGRES_URI) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.scheduled_agent_tasks 
                    (user_id, thread_id, task_description, context_data, trigger_spec, task_type, status, next_run_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (
                        user_id,
                        thread_id,
                        task_description,
                        json.dumps(ctx),
                        time_spec,
                        task_type,
                        "pending",
                        next_run_at
                    )
                )
                task_id = cur.fetchone()[0]
                conn.commit()
        
        # 格式化本地可读显示时间以反馈给用户
        tz_beijing = datetime.timezone(datetime.timedelta(hours=8))
        local_run_time = next_run_at.astimezone(tz_beijing).strftime("%Y-%m-%d %H:%M:%S")
        
        return (
            f"✓ 定时任务登记成功！\n"
            f"- 任务 ID: {task_id}\n"
            f"- 触发规则: [{task_type}] {time_spec}\n"
            f"- 下次唤醒时间: {local_run_time} (北京时间)\n"
            f"到时系统将自动启动 Task Executor 智能体为您处理，您无须再挂念。"
        )
    except Exception as e:
        return f"错误：数据库写入失败 - {str(e)}"
