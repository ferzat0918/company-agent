import os
import json
import psycopg
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from src.config import POSTGRES_URI

@tool
def send_wechat_message(chat_name: str, content: str, config: RunnableConfig = None) -> str:
    """直接向指定的微信联系人或聊天窗口发送文本消息（自动在 PC 微信客户端中打字并发送）。
    
    无论是实时对话，还是在后台定时调度任务中，你都可以使用此工具主动向任何微信好友或群组发送消息。
    
    Args:
        chat_name: 微信好友昵称、备注或群聊名称（必须完全精确匹配微信中的名字，例如 "文件传输助手"、"红领巾" 等）。
        content: 要发送的文本消息内容。
    """
    if not chat_name:
        return "错误：接收人/窗口名称（chat_name）不能为空。"
    if not content:
        return "错误：消息内容（content）不能为空。"
        
    # 解析 user_id 并提供默认 fallback
    user_id = "d81a0391-2663-4f0b-ba89-39f17773a9a1" # Freddy
    if config and isinstance(config, dict):
        configurable = config.get("configurable", {})
        metadata = config.get("metadata", {})
        user_id = (
            configurable.get("owner") or 
            metadata.get("owner") or 
            configurable.get("user_id") or 
            metadata.get("user_id") or 
            user_id
        )
        
    try:
        with psycopg.connect(POSTGRES_URI) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.wechat_push_queue (user_id, chat_name, content, attachments, status)
                    VALUES (%s, %s, %s, '[]'::jsonb, 'pending')
                    """
                , (user_id, chat_name, content))
                conn.commit()
        return f"✓ 已成功将消息推入发送队列！\n- 目标窗口: {chat_name}\n- 消息内容: {content}\n宿主机 RPA 机器人稍后将自动切屏并为您发送。"
    except Exception as e:
        return f"错误：写入微信发送队列失败 - {str(e)}"

@tool
def send_wechat_file(filepath: str, chat_name: str = None, config: RunnableConfig = None) -> str:
    """发送本地沙盒生成的文件、图片或矢量图到微信聊天窗口中。
    
    当你（或后台子智能体）在沙盒中生成了任何文件（如报告、Excel、图片、LOGO 矢量图等），你可以调用此工具发送该实体文件给指定联系人。
    
    Args:
        filepath: 文件在沙盒中的绝对路径，必须以 '/workspace/' 开头。
                  例如: '/workspace/umx-logo/logo-full.svg' 或 '/workspace/weekly_report.xlsx'。
        chat_name: 可选。目标微信聊天窗口/好友名字。如果为空，则默认推送到当前正在对话的会话窗口中。
    """
    if not filepath.startswith("/workspace/"):
        return f"错误：文件路径必须以 '/workspace/' 开头，当前为: {filepath}"
        
    # 如果指定了目标聊天窗口，则直接通过数据库推信队列推送，实现主动发给任意指定联系人
    if chat_name:
        user_id = "d81a0391-2663-4f0b-ba89-39f17773a9a1" # Freddy
        if config and isinstance(config, dict):
            configurable = config.get("configurable", {})
            metadata = config.get("metadata", {})
            user_id = (
                configurable.get("owner") or 
                metadata.get("owner") or 
                configurable.get("user_id") or 
                metadata.get("user_id") or 
                user_id
            )
        try:
            with psycopg.connect(POSTGRES_URI) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO public.wechat_push_queue (user_id, chat_name, content, attachments, status)
                        VALUES (%s, %s, %s, %s, 'pending')
                        """
                    , (user_id, chat_name, f"文件推送：{os.path.basename(filepath)}", json.dumps([filepath])))
                    conn.commit()
            return f"✓ 已成功将文件推入发送队列！\n- 目标窗口: {chat_name}\n- 文件路径: {filepath}\n宿主机 RPA 机器人稍后将自动为您发送该文件。"
        except Exception as e:
            return f"错误：写入微信文件队列失败 - {str(e)}"
            
    # 如果没有指定 chat_name，保持原样，返回前缀标记由当前交互式会话捕获
    return f"[WECHAT_FILE_PUSH]: {filepath}"
