"""Deep Agent configuration with SubAgents and SkillsMiddleware

System prompts are loaded from the prompts/ directory at startup so that
editing a .md file and restarting the container picks up the new prompt
without any code change.
"""
import os
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from deepagents.middleware.filesystem import FilesystemPermission
from .chat_models import ChatDeepSeekThinking
from .round_robin import RoundRobinChatModel
from .config import DEEPSEEK_API_KEY, DEEPSEEK_API_KEYS, DEEPSEEK_MODEL, TAVILY_API_KEY
from .skills_loader import get_skills_config, validate_skills

# ─── Prompt loader ──────────────────────────────────────────────
PROMPTS_DIR = os.getenv("PROMPTS_DIR", "prompts")

# Safety suffix appended to every agent prompt (supervisor + subagents).
# This hard constraint prevents the LLM from calling filesystem-write tools.
_NO_WRITE_SUFFIX = (
    "\n\n你**没有**任何文件写入或编辑能力。"
    "**绝对不要**调用 write_file / edit_file 工具，它们会被拒绝。"
    "如需保留产出，请直接在回答正文中输出文本，用户会自己复制保存。"
)

# Extra constraint for the supervisor: also block reads outside /skills.
_SUPERVISOR_SUFFIX = (
    "\n\n你**没有**任何文件写入或编辑能力，也无法读取 /skills 以外的任何路径。"
    "**绝对不要**调用 write_file / edit_file / ls / read_file"
    "（除非读 /skills 下面的文件）。"
    "直接通过 task 工具把用户问题分发给对应的 SubAgent 即可。"
)


def _load_prompt(relative_path: str, fallback: str = "") -> str:
    """Read a prompt .md file from PROMPTS_DIR.

    If the file doesn't exist, log a warning and return *fallback* so the
    agent can still start (degraded but not crashed).
    """
    full_path = Path(PROMPTS_DIR) / relative_path
    if not full_path.exists():
        print(f"WARNING: prompt file not found: {full_path} — using fallback")
        return fallback
    text = full_path.read_text(encoding="utf-8").strip()
    print(f"  ✓ Loaded prompt: {full_path} ({len(text)} chars)")
    return text


# ─── Filesystem lockdown ────────────────────────────────────────
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

# ─── LLM setup ──────────────────────────────────────────────────
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

# ─── Skills ─────────────────────────────────────────────────────
# Validate skills on startup
skill_errors = validate_skills()
if skill_errors:
    print(f"WARNING: {len(skill_errors)} skill validation error(s):")
    for err in skill_errors:
        print(f"  - {err}")

skills_dirs = get_skills_config()

# ─── Web search tool (Tavily) ───────────────────────────────────
# Inherited by every SubAgent because none of them declare their own
# `tools` field — see deepagents/graph.py:575 (inherit-from-parent logic).
_agent_tools: list = []
if TAVILY_API_KEY:
    # Imported lazily so the package is only required when the key is set.
    from langchain_tavily import TavilySearch
    os.environ.setdefault("TAVILY_API_KEY", TAVILY_API_KEY)
    _agent_tools.append(TavilySearch(max_results=5, topic="general"))
    print("  ✓ Tavily web search enabled")
else:
    print("  ⚠ TAVILY_API_KEY not set — web search disabled")

# ─── Load prompts from disk ─────────────────────────────────────
print(f"Loading prompts from: {PROMPTS_DIR}/")

_supervisor_prompt = _load_prompt(
    "supervisor.md",
    fallback="你是公司内部智能助手 Supervisor。根据用户问题路由到对应的部门 SubAgent。请始终使用中文进行思考和推理。",
)

_marketing_prompt = _load_prompt(
    "subagents/marketing.md",
    fallback="你是公司营销 SubAgent。负责文案撰写、活动策划、品牌推广等任务。请始终使用中文进行思考和推理，使用中文回答。",
)

_hr_prompt = _load_prompt(
    "subagents/hr.md",
    fallback="你是公司 HR SubAgent。负责制度问答、招聘支持、内部公告等任务。请始终使用中文进行思考和推理，使用中文回答。",
)

_tob_prompt = _load_prompt(
    "subagents/tob.md",
    fallback="你是公司 toB 销售 SubAgent。负责客户沟通、方案产出、竞品分析等任务。请始终使用中文进行思考和推理，使用中文回答。",
)

_content_prompt = _load_prompt(
    "subagents/content.md",
    fallback="你是公司内容产出 SubAgent。负责选题、脚本、拍摄剪辑指导等任务。请始终使用中文进行思考和推理，使用中文回答。",
)

# ─── SubAgents ──────────────────────────────────────────────────
SUBAGENTS = [
    {
        "name": "marketing-agent",
        "description": "处理市场推广、文案、EDM、活动策划相关任务",
        "system_prompt": _marketing_prompt + _NO_WRITE_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "hr-agent",
        "description": "处理人力资源相关咨询和事务，如请假流程、招聘、制度查询",
        "system_prompt": _hr_prompt + _NO_WRITE_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "tob-agent",
        "description": "处理 B 端销售和客户相关任务，如方案书、报价、客户邮件",
        "system_prompt": _tob_prompt + _NO_WRITE_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "content-agent",
        "description": "处理内容产出相关任务，如选题策划、脚本、平台规范",
        "system_prompt": _content_prompt + _NO_WRITE_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
]

# ─── Supervisor (top-level agent) ───────────────────────────────
agent = create_deep_agent(
    name="company-agent",
    model=_llm,
    tools=_agent_tools,
    system_prompt=_supervisor_prompt + _SUPERVISOR_SUFFIX,
    subagents=SUBAGENTS,
    skills=skills_dirs,
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),
    permissions=AGENT_FS_PERMISSIONS,
)
