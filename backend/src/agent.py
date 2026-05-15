"""Deep Agent configuration with SubAgents and SkillsMiddleware"""
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from deepagents.middleware.filesystem import FilesystemPermission
from .chat_models import ChatDeepSeekThinking
from .round_robin import RoundRobinChatModel
from .config import DEEPSEEK_API_KEY, DEEPSEEK_API_KEYS, DEEPSEEK_MODEL
from .skills_loader import get_skills_config, validate_skills

# Filesystem lockdown for every user-facing agent call.
#
# Deep Agents exposes ls/read/write/edit/glob/grep tools by default. For a
# chat assistant whose job is copywriting/HR/sales, none of these need to
# touch the host. Without this, anyone chatting with the agent can read
# /app/backend source, write to /app/skills (which is bind-mounted back to
# the host), or edit prompts — i.e. full RCE through the chat UI.
#
# Rules are first-match-wins. Listed order:
#   1. Allow read inside /skills (so SkillsMiddleware + any read tool work)
#   2. Deny read everywhere else (blocks ls / read_file / glob / grep)
#   3. Deny write everywhere (blocks write_file / edit_file)
#
# Note: SkillsMiddleware reads skill files via the backend directly, which
# bypasses these permission rules — so skills still load even though tool
# reads are denied outside /skills.
AGENT_FS_PERMISSIONS = [
    FilesystemPermission(
        operations=["read"],
        paths=["/skills", "/skills/**"],
        mode="allow",
    ),
    FilesystemPermission(
        operations=["read"],
        paths=["/**"],
        mode="deny",
    ),
    FilesystemPermission(
        operations=["write"],
        paths=["/**"],
        mode="deny",
    ),
]

# Use round-robin when multiple keys are configured
if len(DEEPSEEK_API_KEYS) > 1:
    _llm = RoundRobinChatModel(
        api_keys=DEEPSEEK_API_KEYS,
        model=DEEPSEEK_MODEL,
        temperature=0.3,
    )
else:
    _llm = ChatDeepSeekThinking(
        model=DEEPSEEK_MODEL,
        api_key=DEEPSEEK_API_KEY,
        temperature=0.3,
    )

# Validate skills on startup
skill_errors = validate_skills()
if skill_errors:
    print(f"WARNING: {len(skill_errors)} skill validation error(s):")
    for err in skill_errors:
        print(f"  - {err}")

skills_dirs = get_skills_config()

SUBAGENTS = [
    {
        "name": "marketing-agent",
        "description": "处理市场推广、文案、EDM、活动策划相关任务",
        "system_prompt": "你是公司营销 SubAgent。负责文案撰写、活动策划、品牌推广等任务。请始终使用中文进行思考和推理，使用中文回答。",
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "hr-agent",
        "description": "处理人力资源相关咨询和事务，如请假流程、招聘、制度查询",
        "system_prompt": "你是公司 HR SubAgent。负责制度问答、招聘支持、内部公告等任务。请始终使用中文进行思考和推理，使用中文回答。",
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "tob-agent",
        "description": "处理 B 端销售和客户相关任务，如方案书、报价、客户邮件",
        "system_prompt": "你是公司 toB 销售 SubAgent。负责客户沟通、方案产出、竞品分析等任务。请始终使用中文进行思考和推理，使用中文回答。",
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "content-agent",
        "description": "处理内容产出相关任务，如选题策划、脚本、平台规范",
        "system_prompt": "你是公司内容产出 SubAgent。负责选题、脚本、拍摄剪辑指导等任务。请始终使用中文进行思考和推理，使用中文回答。",
        "model": _llm,
        "skills": skills_dirs,
    },
]

agent = create_deep_agent(
    name="company-agent",
    model=_llm,
    system_prompt="你是公司内部智能助手 Supervisor。根据用户问题路由到对应的部门 SubAgent。请始终使用中文进行思考和推理。",
    subagents=SUBAGENTS,
    skills=skills_dirs,
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),
    permissions=AGENT_FS_PERMISSIONS,
)
