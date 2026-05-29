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

# ─── Prompt loader ──────────────────────────────────────────────
PROMPTS_DIR = os.getenv("PROMPTS_DIR", "prompts")

# Suffix appended to subagent prompts explaining the safe python execution sandbox
_SANDBOX_SUFFIX = (
    "\n\n【文件与数据处理安全沙盒说明】\n"
    "1. 你可以通过调用 `execute_python_in_sandbox` 工具，在安全的 Docker Python 沙盒环境中编写和运行 Python 代码来处理、分析、编辑或生成文件。\n"
    "2. 用户上传的文件已自动保存在 `/workspace/<文件名>`。你在编写 Python 代码时，可以直接在当前目录下读取这些文件（沙盒工作目录为 `/workspace`）。\n"
    "3. 你在沙盒中生成的任何新文件或修改后的文件，请直接保存在 `/workspace` 当前目录下，它们会同步保存到用户的本地工作区。\n"
    "4. **重要：当你在沙盒中生成、转换或修改了任何文件后，你必须在回答中提供形如 `[点击下载 文件名](/workspace/文件名)` 的 markdown 格式下载链接（例如：`[点击下载 report.docx](/workspace/report.docx)`），以便用户在聊天界面直接点击下载。绝对不能漏掉该下载链接！**\n"
    "5. 请注意：你自身**没有**直接在宿主机写入或编辑文件的能力（直接调用 write_file / edit_file 等底层工具会被安全权限拦截），因此所有文件生成、编辑、转换和复杂数据解析都**必须**通过在 `execute_python_in_sandbox` 中编写 Python 代码来完成。"
)

# Supervisor prompt suffix
_SUPERVISOR_SANDBOX_SUFFIX = (
    "\n\n【文件与数据处理安全沙盒说明】\n"
    "1. 用户的全部文件操作和数据分析均需通过调用 `execute_python_in_sandbox` 工具或分发给各部门 SubAgent 完成。\n"
    "2. 你可以直接调用 `execute_python_in_sandbox`，也可以通过 task 工具将任务派发给相应的子 Agent（子 Agent 也拥有完整的沙盒执行能力）。\n"
    "3. 任何需要读取、生成或修改文件的任务，都**必须**在 `execute_python_in_sandbox` 沙盒环境中运行 Python 代码处理（代码工作目录为 `/workspace`）。直接的 write_file / edit_file 依然是被禁止的。\n"
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

# ─── WeChat File Sending Tool ────────────────────────────────────
from langchain_core.tools import tool

@tool
def send_wechat_file(filepath: str) -> str:
    """发送本地沙盒生成的文件、图片或矢量图到微信当前的聊天窗口中。
    
    当你（或后台子智能体）在沙盒中生成了任何文件（如报告、Excel、LOGO 矢量图等），且用户当前是在微信渠道时，
    你【必须】调用此工具来直接发送该实体文件给用户。
    
    Args:
        filepath: 文件在沙盒中的绝对路径，必须以 '/workspace/' 开头。
                  例如: '/workspace/umx-logo/logo-full.svg' 或 '/workspace/weekly_report.xlsx'。
    """
    if not filepath.startswith("/workspace/"):
        return f"错误：文件路径必须以 '/workspace/' 开头，当前为: {filepath}"
    return f"[WECHAT_FILE_PUSH]: {filepath}"

# ─── Du's API Image Generation Tool ──────────────────────────────
import uuid
import requests
from langchain_core.runnables.config import var_child_runnable_config

@tool
def draw_image(prompt: str) -> str:
    """当你（或者子部门 Agent）需要根据文字描述生成、画制或创作任何图片、插画、Logo、海报等视觉内容时调用此工具。
    
    该工具会将你的描述发送至 GPT 顶尖图像生成模型（DALL-E 3）完成创作，并自动将成品图保存至当前会话的物理工作区。
    
    Args:
        prompt: 对图片内容极其细致且富有艺术色彩的详细中文描述。
    """
    if not GPT_API_KEY:
        return "错误：未配置生图 API 秘钥 (GPT_API_KEY)，请联系系统管理员在 .env 中配置。"
        
    try:
        config = var_child_runnable_config.get()
        thread_id = "default"
        if config and isinstance(config, dict):
            thread_id = config.get("configurable", {}).get("thread_id", "default")
    except Exception:
        thread_id = "default"
        
    print(f"[Image Generator] Received draw task for thread [{thread_id}]. Prompt: {prompt}")

    headers = {
        "Authorization": f"Bearer {GPT_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-image-2",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024"
    }

    try:
        url = f"{GPT_BASE_URL.rstrip('/')}/images/generations"
        response = requests.post(url, json=payload, headers=headers, timeout=180)
        response.raise_for_status()
        
        res_data = response.json()
        data_list = res_data.get("data", [])
        if not data_list:
            raise KeyError(f"返回数据中的 'data' 字段为空: {res_data}")
            
        first_item = data_list[0]
        image_url = None
        is_base64 = False
        
        if isinstance(first_item, str):
            image_url = first_item
        elif isinstance(first_item, dict):
            for key in ["url", "URL", "uri", "URI", "link", "b64_json"]:
                if key in first_item:
                    image_url = first_item[key]
                    if key == "b64_json":
                        is_base64 = True
                    break
            
            if not image_url:
                for val in first_item.values():
                    if isinstance(val, str) and val.startswith(("http://", "https://")):
                        image_url = val
                        break
                        
        if not image_url:
            raise KeyError(f"无法从返回数据中识别出有效的图片资源！返回的第一项为: {first_item}")

        img_data = None
        if is_base64 or (isinstance(image_url, str) and not image_url.startswith(("http://", "https://"))):
            import base64
            base64_str = str(image_url)
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]
            img_data = base64.b64decode(base64_str)
        else:
            img_response = requests.get(image_url, timeout=90)
            img_response.raise_for_status()
            img_data = img_response.content
        
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        workspace_dir = os.path.join(project_root, "workspace", thread_id)
        os.makedirs(workspace_dir, exist_ok=True)
        
        filename = f"art_{uuid.uuid4().hex[:8]}.png"
        dest_filepath = os.path.join(workspace_dir, filename)
        
        with open(dest_filepath, "wb") as f:
            f.write(img_data)
            
        print(f"[Image Generator] Successfully downloaded and saved image to: {dest_filepath}")
        
        return (
            f"✓ 图像已成功生成！文件已安全同步至您的工作区。\n\n"
            f"![{filename}](/workspace/{thread_id}/{filename})"
        )
        
    except Exception as e:
        error_detail = ""
        try:
            # 尝试获取并读取请求返回体
            if 'response' in locals() and response is not None and hasattr(response, 'text'):
                error_detail = f"\n中转站详细返回: {response.text}"
        except Exception:
            pass
        print(f"[Image Generator] Error during generation: {str(e)}{error_detail}")
        return f"⚠ 图像生成过程中发生网络或API交互错误，生成失败: {str(e)}{error_detail}"

# ─── System Current Time Tool ────────────────────────────────────
@tool
def get_current_time() -> str:
    """获取当前系统的准确本地日期和时间（北京时间 CST, UTC+8）。
    
    当用户询问与当前时间、今天、昨天、明天相关的时效性问题，或者需要查询最新新闻时，
    你必须首先调用此工具以获取准确的本地日期和时间，以便为搜索工具提供正确的日期背景。
    """
    import datetime
    # 强制使用北京时间 (UTC+8)，解决 Docker 容器内部默认 UTC 时间与宿主机存在 8 小时时差的问题
    tz_beijing = datetime.timezone(datetime.timedelta(hours=8))
    now = datetime.datetime.now(tz_beijing)
    weekday_map = {0: "星期一", 1: "星期二", 2: "星期三", 3: "星期四", 4: "星期五", 5: "星期六", 6: "星期日"}
    weekday_str = weekday_map.get(now.weekday(), "")
    return now.strftime(f"当前系统时间为: %Y-%m-%d %H:%M:%S ({weekday_str})")

# ─── Web search tool (Tavily) ───────────────────────────────────
# Inherited by every SubAgent because none of them declare their own
# `tools` field — see deepagents/graph.py:575 (inherit-from-parent logic).
_agent_tools: list = [_memory_tool, _memory_undo_tool, sandbox_tool, send_wechat_file, draw_image, get_current_time]
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
