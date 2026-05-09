"""Deep Agent configuration with 4 department SubAgents"""
from deepagents import create_deep_agent
from .config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL

SUBAGENTS = [
    {
        "name": "marketing-agent",
        "description": "处理市场推广、文案、EDM、活动策划相关任务",
        "system_prompt": "你是公司营销 SubAgent。负责文案撰写、活动策划、品牌推广等任务。使用中文回答。",
        "model": DEEPSEEK_MODEL,
    },
    {
        "name": "hr-agent",
        "description": "处理人力资源相关咨询和事务，如请假流程、招聘、制度查询",
        "system_prompt": "你是公司 HR SubAgent。负责制度问答、招聘支持、内部公告等任务。使用中文回答。",
        "model": DEEPSEEK_MODEL,
    },
    {
        "name": "tob-agent",
        "description": "处理 B 端销售和客户相关任务，如方案书、报价、客户邮件",
        "system_prompt": "你是公司 toB 销售 SubAgent。负责客户沟通、方案产出、竞品分析等任务。使用中文回答。",
        "model": DEEPSEEK_MODEL,
    },
    {
        "name": "content-agent",
        "description": "处理内容产出相关任务，如选题策划、脚本、平台规范",
        "system_prompt": "你是公司内容产出 SubAgent。负责选题、脚本、拍摄剪辑指导等任务。使用中文回答。",
        "model": DEEPSEEK_MODEL,
    },
]

agent = create_deep_agent(
    name="company-agent",
    model=DEEPSEEK_MODEL,
    system_prompt="你是公司内部智能助手 Supervisor。根据用户问题路由到对应的部门 SubAgent。",
    subagents=SUBAGENTS,
)
