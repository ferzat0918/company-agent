import os
import json
import datetime
import psycopg
import threading
import traceback
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from src.config import POSTGRES_URI

# 初始化全局后台调度器
scheduler = BackgroundScheduler()

def reset_orphaned_tasks():
    """在调度器启动或载入时，自动将所有处于 'running' 状态的悬挂/孤儿任务重置为 'pending'，
    防止系统重启、容器被强制重建导致的任务状态被永久锁死。
    """
    try:
        with psycopg.connect(POSTGRES_URI) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.scheduled_agent_tasks 
                    SET status = 'pending' 
                    WHERE status = 'running'
                    """
                )
                rows_updated = cur.rowcount
                conn.commit()
                if rows_updated > 0:
                    print(f"[Scheduler Startup] 成功重置 {rows_updated} 个因系统重启/崩溃而挂起的 'running' 状态任务为 'pending'！")
    except Exception as e:
        print(f"[Scheduler Startup] 重置挂起任务失败: {e}")

# 立即执行孤儿任务重置
reset_orphaned_tasks()

def _run_agent_task_async(task_id: str, thread_id: str, task_description: str, context_data: dict, task_type: str, time_spec: str, user_id: str):
    """在独立的后台线程中异步执行 LangGraph 智能体逻辑，并自动回写数据库状态"""
    print(f"[Scheduler Worker] 正在执行定时任务 {task_id} ...")
    
    try:
        # 1. 惰性导入 agent 实例，彻底规避 circular imports 循环依赖
        from src.agent import agent
        
        # 2. 准备大模型原生输入与系统指令注入
        inputs = {
            "messages": [
                {
                    "type": "human",
                    "content": (
                        f"【系统后台自动化任务执行指令（极重要）】\n"
                        f"这是前置智能体为你留下的交班说明书。请你仔细阅读并作为一个独立的自动化执行智能体，自主调用最合适的工具（如 sandbox 进行数据分析、wechat 推送文件等）来达成目标！\n"
                        f"执行完成后，如果有生成的文件或结果，请务必直接调用相应的渠道工具发送给目标用户，无须在此向系统反馈。\n\n"
                        f"【任务说明书】:\n{task_description}\n\n"
                        f"【静态上下文参数】:\n{json.dumps(context_data, ensure_ascii=False)}"
                    )
                }
            ]
        }
        
        # 注入完整的线程上下文，使得 MemoryInjectMiddleware 自动为后台执行加载历史背景和身份档案
        config = {
            "metadata": {
                "channel": context_data.get("channel", "web"),
                "chat_name": context_data.get("chat_name", "系统会话"),
                "sender": context_data.get("sender", "系统"),
                "owner": user_id,
            },
            "configurable": {
                "thread_id": thread_id,
                "channel": context_data.get("channel", "web"),
                "chat_name": context_data.get("chat_name", "系统会话"),
                "sender": context_data.get("sender", "系统"),
                "owner": user_id,
            }
        }
        
        # 3. 异步执行图，等待 AI 链式决策工具调用直至完成，使用 ainvoke 完美适配 async 拦截中间件
        import asyncio
        res = asyncio.run(agent.ainvoke(inputs, config=config))
        
        # 如果是微信渠道，且任务执行产生了输出，则自动灌入 wechat_push_queue 供宿主机 RPA 消费
        channel = context_data.get("channel", "web")
        if channel == "wechat" and res and isinstance(res, dict):
            messages = res.get("messages", [])
            reply_content = ""
            target_files = []
            
            # 从后往前寻找第一个非空的 AI 消息内容作为文字回复
            for m in reversed(messages):
                m_type = getattr(m, "type", None) or (m.get("type") if isinstance(m, dict) else None)
                m_content = getattr(m, "content", "") or (m.get("content") if isinstance(m, dict) else "")
                if m_type == "ai" and m_content:
                    reply_content = m_content
                    break
            
            # 扫描提取所有被调用的 send_wechat_file 工具路径
            for m in messages:
                m_name = getattr(m, "name", None) or (m.get("name") if isinstance(m, dict) else None)
                if m_name == "send_wechat_file":
                    m_content = getattr(m, "content", "") or (m.get("content") if isinstance(m, dict) else "")
                    if isinstance(m_content, str) and m_content.startswith("[WECHAT_FILE_PUSH]:"):
                        filepath = m_content.split(":", 1)[1].strip()
                        if filepath not in target_files:
                            target_files.append(filepath)
            
            # 只要有回复文本或有文件需要推送，就写入推送队列
            if reply_content or target_files:
                chat_name = context_data.get("chat_name", "文件传输助手")
                print(f"[Scheduler Worker] 正在向 wechat_push_queue 灌入推送任务：chat_name={chat_name}, content_len={len(reply_content)}, files={target_files}")
                with psycopg.connect(POSTGRES_URI) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO public.wechat_push_queue (user_id, chat_name, content, attachments, status)
                            VALUES (%s, %s, %s, %s, 'pending')
                            """,
                            (user_id, chat_name, reply_content, json.dumps(target_files))
                        )
                        conn.commit()
        
        # 4. 执行成功后，更新任务状态
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        with psycopg.connect(POSTGRES_URI) as conn:
            with conn.cursor() as cur:
                if task_type == "one-shot":
                    cur.execute(
                        "UPDATE public.scheduled_agent_tasks SET status = 'completed', executed_at = %s WHERE id = %s",
                        (now_utc, task_id)
                    )
                elif task_type == "cron":
                    # 计算下一次 Cron 执行时间
                    try:
                        trigger = CronTrigger.from_crontab(time_spec, timezone=datetime.timezone.utc)
                        next_run_at = trigger.get_next_fire_time(None, now_utc)
                        if next_run_at:
                            cur.execute(
                                "UPDATE public.scheduled_agent_tasks SET status = 'pending', next_run_at = %s, executed_at = %s WHERE id = %s",
                                (next_run_at, now_utc, task_id)
                            )
                        else:
                            cur.execute(
                                "UPDATE public.scheduled_agent_tasks SET status = 'completed', executed_at = %s WHERE id = %s",
                                (now_utc, task_id)
                            )
                    except Exception as cron_err:
                        cur.execute(
                            "UPDATE public.scheduled_agent_tasks SET status = 'failed', error_log = %s, executed_at = %s WHERE id = %s",
                            (f"Cron 重置失败: {cron_err}", now_utc, task_id)
                        )
                conn.commit()
        print(f"[Scheduler Worker] 定时任务 {task_id} 成功完成！")
        
    except Exception as err:
        tb = traceback.format_exc()
        print(f"[Scheduler Worker] 定时任务 {task_id} 执行出错:\n{tb}")
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        try:
            with psycopg.connect(POSTGRES_URI) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE public.scheduled_agent_tasks SET status = 'failed', error_log = %s, executed_at = %s WHERE id = %s",
                        (tb, now_utc, task_id)
                    )
                    conn.commit()
        except Exception as db_err:
            print(f"[Scheduler Worker] 写入错误日志失败: {db_err}")

def poll_scheduled_tasks():
    """扫描数据库，寻找并分发所有已到达预定时间的 pending 状态任务"""
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    
    try:
        # 获取待执行任务列表
        tasks_to_run = []
        with psycopg.connect(POSTGRES_URI) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, thread_id, task_description, context_data, task_type, trigger_spec, user_id
                    FROM public.scheduled_agent_tasks
                    WHERE status = 'pending' AND next_run_at <= %s
                    """,
                    (now_utc,)
                )
                rows = cur.fetchall()
                for row in rows:
                    tasks_to_run.append({
                        "id": row[0],
                        "thread_id": row[1],
                        "task_description": row[2],
                        "context_data": row[3],
                        "task_type": row[4],
                        "time_spec": row[5],
                        "user_id": row[6]
                    })
                    
                # 批量把将要运行的任务状态更新为 'running'，起到并发控制锁的作用
                if tasks_to_run:
                    task_ids = [t["id"] for t in tasks_to_run]
                    cur.execute(
                        "UPDATE public.scheduled_agent_tasks SET status = 'running' WHERE id = ANY(%s)",
                        (task_ids,)
                    )
                    conn.commit()
        
        # 异步并发执行捞到的每一个定时任务，防止由于某一个任务耗时长阻塞轮询主循环
        for task in tasks_to_run:
            print(f"[Scheduler] 成功检索到定时任务 {task['id']}，正在启动异步线程执行...")
            t = threading.Thread(
                target=_run_agent_task_async,
                args=(
                    task["id"],
                    task["thread_id"],
                    task["task_description"],
                    task["context_data"],
                    task["task_type"],
                    task["time_spec"],
                    task["user_id"]
                ),
                daemon=True
            )
            t.start()
            
    except Exception as e:
        print(f"[Scheduler] 轮询任务表发生异常: {e}")

# 注册 10 秒轮询数据库定时 job
scheduler.add_job(poll_scheduled_tasks, 'interval', seconds=10, id='db_task_poller')
