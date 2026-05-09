"""Deep Agent configuration (minimal)"""
from deepagents import create_deep_agent
from .config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL

agent = create_deep_agent(
    name="company-agent",
    model=DEEPSEEK_MODEL,
    system_prompt="你是公司内部智能助手。使用中文回答。",
)
