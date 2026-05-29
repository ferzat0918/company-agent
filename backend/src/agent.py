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
    """获取当前系统的准确本地日期 and 时间（北京时间 CST, UTC+8）。
    
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

# ─── Web Page Scraper Tool ──────────────────────────────────────
from html.parser import HTMLParser

class GenericWebpageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_body = False
        self.in_js_content = False
        self.js_content_div_count = 0
        self.ignored_depth = 0
        self.js_content_parts = []
        self.body_parts = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        if tag == "body":
            self.in_body = True
            
        if tag in ("script", "style"):
            self.ignored_depth += 1
            return
            
        if tag == "div" and attrs_dict.get("id") == "js_content":
            self.in_js_content = True
            self.js_content_div_count = 1
            return
            
        if self.in_js_content:
            if tag == "div":
                self.js_content_div_count += 1
            elif tag in ("p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
                self.js_content_parts.append("\n")
                
        if self.in_body and not self.in_js_content:
            if tag in ("p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "div"):
                self.body_parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "body":
            self.in_body = False
            
        if tag in ("script", "style"):
            self.ignored_depth = max(0, self.ignored_depth - 1)
            return
            
        if self.in_js_content:
            if tag == "div":
                self.js_content_div_count -= 1
                if self.js_content_div_count == 0:
                    self.in_js_content = False

    def handle_data(self, data):
        if self.ignored_depth > 0:
            return
            
        text = data.strip()
        if not text:
            return
            
        if self.in_js_content:
            self.js_content_parts.append(text + " ")
        elif self.in_body:
            self.body_parts.append(text + " ")

    def get_text(self) -> str:
        if self.js_content_parts:
            full_text = "".join(self.js_content_parts)
        else:
            full_text = "".join(self.body_parts)
            
        lines = [line.strip() for line in full_text.split("\n")]
        return "\n".join([line for line in lines if line])


@tool
def fetch_webpage(url: str) -> str:
    """直接爬取、解析并提取任意公开网页或微信公众号文章的正文文本内容。
    
    当用户在聊天中发来任何网页链接（如 mp.weixin.qq.com 微信公众号链接或其他新闻、博客、文章链接），
    且你需要阅读、分析、概括该网页的核心内容时，必须调用此工具以获取该网页的完整纯文本。
    
    Args:
        url: 需要获取正文的网页绝对 URL 链接（如 'https://mp.weixin.qq.com/s/xxxxxx'）。
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=15.0)
        if response.status_code != 200:
            return f"获取网页失败，HTTP 状态码: {response.status_code}"
            
        parser = GenericWebpageParser()
        html_content = response.content.decode(response.encoding or 'utf-8', errors='ignore')
        parser.feed(html_content)
        parsed_text = parser.get_text()
        
        if not parsed_text:
            return "网页请求成功，但未能解析出有效的正文文本。"
            
        return parsed_text
        
    except Exception as e:
        return f"抓取网页发生异常: {str(e)}"

# ─── Web search tool (Tavily) ───────────────────────────────────
# Inherited by every SubAgent because none of them declare their own
# `tools` field — see deepagents/graph.py:575 (inherit-from-parent logic).
_agent_tools: list = [_memory_tool, _memory_undo_tool, sandbox_tool, send_wechat_file, draw_image, get_current_time, fetch_webpage]
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
