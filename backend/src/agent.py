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
from .config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_API_KEYS,
    DEEPSEEK_MODEL,
    TAVILY_API_KEY,
    GPT_API_KEY,
    GPT_BASE_URL,
)
from .memory.prompt_inject import MemoryInjectMiddleware
from .wechat_middleware import WeChatChannelMiddleware
from .memory.tool import make_memory_tool, make_memory_undo_tool
from .skills_loader import get_skills_config, validate_skills
from .sandbox import sandbox_tool
from src.tools import (
    send_wechat_file,
    send_wechat_message,
    draw_image,
    get_current_time,
    fetch_webpage,
    get_tavily_tool,
    schedule_agent_task,
)

# ─── Prompt loader ──────────────────────────────────────────────
PROMPTS_DIR = os.getenv("PROMPTS_DIR", "prompts")

# Suffix appended to subagent prompts explaining the safe python execution sandbox
_SANDBOX_SUFFIX = (
    "\n\n【文件与数据处理安全沙盒说明（极重要）】\n"
    "1. **沙盒环境是完全临时的（Ephemeral）**：每次你调用 `execute_python_in_sandbox`，都会启动一个全新的、干净的沙盒容器，代码运行结束后该容器会被**物理销毁**。任何你通过 `pip install`、`apt-get` 或是下载至系统目录的变化都会**全部丢失**，绝对不会继承到下一次调用中！\n"
    "2. **严禁在代码中尝试安装包或字体**：请绝对不要在 Python 代码中通过 `subprocess` 执行 `pip install`、`apt-get update/install` 或是下载额外的字体文件，这不仅无效，还会产生数百MB的垃圾传输导致网络极大延误和无限重试循环！\n"
    "3. **已为您预装常用库和中文字体**：沙盒镜像中已经预装了：`pandas, openpyxl, python-docx, pdfplumber, matplotlib, Pillow, fpdf2, fonttools, reportlab, pypdf, cairosvg, moviepy` 等库。同时**中文字体也已预先安装**在系统路径：`/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`（Noto Sans CJK Regular）以及 `NotoSansCJK-Bold.ttc`（Noto Sans CJK Bold）。\n"
    "4. **如何添加中文字体 (FPDF2 示例)**：直接加载系统路径，严禁下载字体！\n"
    "   ```python\n"
    "   from fpdf import FPDF\n"
    "   pdf = FPDF()\n"
    "   pdf.add_font('NotoSans', '', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')\n"
    "   pdf.add_font('NotoSans', 'B', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc')\n"
    "   ```\n"
    "5. **如何添加中文字体 (ReportLab 示例)**：\n"
    "   ```python\n"
    "   from reportlab.pdfbase import pdfmetrics\n"
    "   from reportlab.pdfbase.ttfonts import TTFont\n"
    "   pdfmetrics.registerFont(TTFont('NotoSansCJK', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'))\n"
    "   ```\n"
    "6. **文件读取与输出**：用户上传的文件在当前工作目录（沙盒工作目录为 `/workspace`），你可以直接读取。生成的新文件也必须保存在当前目录下。\n"
    "7. **重要：当你在沙盒中生成、转换或修改了任何文件后，你必须在回答中提供形如 `[点击下载 文件名](/workspace/文件名)` 的 markdown 格式下载链接（例如：`[点击下载 report.docx](/workspace/report.docx)`），以便用户在聊天界面直接点击下载。绝对不能漏掉该下载链接！**\n"
    "8. 请注意：你自身**没有**直接在宿主机写入或编辑文件的能力（直接调用 write_file / edit_file 等底层工具会被安全权限拦截），因此所有文件生成、编辑、转换和复杂数据解析都**必须**通过在 `execute_python_in_sandbox` 中编写 Python 代码来完成。"
)

# Supervisor prompt suffix
_SUPERVISOR_SANDBOX_SUFFIX = (
    "\n\n【文件与数据处理安全沙盒说明（极重要）】\n"
    "1. 用户的全部文件操作和数据分析均需通过调用 `execute_python_in_sandbox` 工具或分发给各部门 SubAgent 完成。\n"
    "2. 任何需要读取、生成或修改文件的任务，都**必须**在 `execute_python_in_sandbox` 沙盒环境中运行 Python 代码处理（代码工作目录为 `/workspace`）。\n"
    "3. **沙盒容器是完全临时的（Ephemeral）**，运行完即毁，严禁让子 Agent 或在代码中尝试通过 `pip` / `apt-get` 安装任何东西，也严禁从外部下载字体，所需库与中文字体（Noto Sans CJK，路径：`/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`）已全部为您预装在沙盒镜像中！\n"
    "4. **重要：当在沙盒中生成、转换或修改了任何文件后，你作为 Supervisor 汇总回答时，也必须确保在回答中包含形如 `[点击下载 文件名](/workspace/文件名)` 的 markdown 下载链接，以便用户在聊天界面能直接点击下载。**"
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
    print(f"  [OK] Loaded prompt: {full_path} ({len(text)} chars)")
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

# ─── Long-term memory ──────────────────────────────────────────
# Per-user namespaced Postgres-backed Store. Exposed as both:
#  - a tool (so the supervisor + every SubAgent can call memory.add)
#  - a middleware (so each new thread starts with the user's prior
#    memory rendered into the system message stream).
#
# The actual Store instance is provisioned by the LangGraph platform via
# langgraph-docker.json's `store` field (see Dockerfile.langgraph) — we
# never construct it here. The middleware's abefore_agent hook captures
# both the runtime.store and the auth-resolved user_id, then the tool
# reads them back through callables.


def _user_id_from_runtime(runtime) -> str | None:
    """Resolve the requesting user's Supabase id from the LangGraph runtime.

    auth.py's verify_supabase_jwt returns ``{"identity": user_id, ...}``;
    LangGraph wraps that in a ProxyUser and exposes it as
    ``runtime.server_info.user.identity``.  (runtime.context is unrelated —
    that's for graph-level user-provided context, which we don't use.)
    """
    server_info = getattr(runtime, "server_info", None)
    user = getattr(server_info, "user", None) if server_info else None
    if user is None:
        return None
    return getattr(user, "identity", None)


_memory_middleware = MemoryInjectMiddleware(
    get_user_id_from_runtime=_user_id_from_runtime,
)
_memory_tool = make_memory_tool(
    get_store=lambda: _memory_middleware._last_store,
    get_user_id=lambda: _memory_middleware._last_user_id,
)
_memory_undo_tool = make_memory_undo_tool(
    get_store=lambda: _memory_middleware._last_store,
    get_user_id=lambda: _memory_middleware._last_user_id,
)

# ─── Modular Tools Loading ──────────────────────────────────────
_agent_tools: list = [
    _memory_tool,
    _memory_undo_tool,
    sandbox_tool,
    send_wechat_file,
    send_wechat_message,
    draw_image,
    get_current_time,
    fetch_webpage,
    schedule_agent_task,
]

_tavily_tool = get_tavily_tool()
if _tavily_tool:
    _agent_tools.append(_tavily_tool)
    print("  [OK] Tavily web search enabled")
else:
    print("  [Warning] TAVILY_API_KEY not set — web search disabled")

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

_wechat_prompt = _load_prompt(
    "subagents/wechat.md",
    fallback="你是专门处理微信端消息的 SubAgent。请保持语言精炼、排版清爽、语调亲和，善用Emoji。",
)

# ─── SubAgents ──────────────────────────────────────────────────
SUBAGENTS = [
    {
        "name": "marketing-agent",
        "description": "处理市场推广、文案、EDM、活动策划相关任务",
        "system_prompt": _marketing_prompt + _SANDBOX_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "hr-agent",
        "description": "处理人力资源相关咨询和事务，如请假流程、招聘、制度查询",
        "system_prompt": _hr_prompt + _SANDBOX_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "tob-agent",
        "description": "处理 B 端销售和客户相关任务，如方案书、报价、客户邮件",
        "system_prompt": _tob_prompt + _SANDBOX_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "content-agent",
        "description": "处理内容产出相关任务，如选题策划、脚本、平台规范",
        "system_prompt": _content_prompt + _SANDBOX_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
    {
        "name": "wechat-agent",
        "description": "专门处理来自微信端的消息。负责以亲和、精炼的格式答复微信用户，并在需要时调度营销、HR、B端销售等后台 Agent 协作。",
        "system_prompt": _wechat_prompt + _SANDBOX_SUFFIX,
        "model": _llm,
        "skills": skills_dirs,
    },
]

# ─── Supervisor (top-level agent) ───────────────────────────────
agent = create_deep_agent(
    name="company-agent",
    model=_llm,
    tools=_agent_tools,
    system_prompt=_supervisor_prompt + _SUPERVISOR_SANDBOX_SUFFIX,
    subagents=SUBAGENTS,
    skills=skills_dirs,
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),
    permissions=AGENT_FS_PERMISSIONS,
    middleware=[_memory_middleware, WeChatChannelMiddleware()],
)

# ─── Start Background Task Scheduler ─────────────────────────────
try:
    from src.scheduler import scheduler
    if not scheduler.running:
        scheduler.start()
        print("  [OK] Background Task Scheduler daemon successfully started!")
except Exception as e:
    print(f"  [Warning] Failed to start Background Task Scheduler: {e}")

