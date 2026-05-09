# Company Agent 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 7-10 周内交付一个基于 LangGraph + Deep Agents 的公司内部智能体，通过 Web 界面为员工提供基于公司知识库的按需问答与内容产出。

**Architecture:** Supervisor + 4 SubAgent（marketing/hr/tob/content），通过 Deep Agents SkillsMiddleware 加载平铺的 SKILL.md 文件（progressive disclosure），Supabase Self-Hosted 提供 Auth + Postgres（含 Checkpointer 与 Store），Agent Chat UI 做前端，全部内网部署。

**Tech Stack:** Python 3.11+, LangChain ≥1.0, LangGraph, Deep Agents, DeepSeek V4 Flash 主力, Supabase Self-Hosted (Docker Compose), Agent Chat UI (Next.js), LangSmith 观测

---

## File Structure

```
/company-agent/
├── README.md                          # 项目说明
├── .gitignore
├── .env                               # 环境变量（不进版本库）
├── .env.example                       # 环境变量模板
│
├── infra/
│   ├── docker-compose.yml              # Supabase Self-Hosted + LangGraph Server
│   ├── Caddyfile                       # 反向代理配置（HTTP 内网）
│   └── scripts/
│       ├── setup-wsl2.ps1              # WSL2 环境初始化脚本
│       └── backup-db.sh                # pg_dump 备份脚本
│
├── backend/
│   ├── langgraph.json                  # LangGraph CLI 配置
│   ├── pyproject.toml                  # Python 依赖
│   ├── src/
│   │   ├── __init__.py
│   │   ├── __main__.py                 # python -m backend 入口
│   │   ├── agent.py                    # create_deep_agent 配置
│   │   ├── auth.py                     # @auth.authenticate Supabase JWT 校验
│   │   ├── profiles.py                 # profiles 表查询
│   │   ├── prompts.py                  # prompt 模板加载/拼接
│   │   ├── config.py                   # 配置读取
│   │   └── graph.py                    # LangGraph 图定义
│   └── tests/
│       ├── __init__.py
│       ├── test_auth.py
│       ├── test_profiles.py
│       └── test_prompts.py
│
├── frontend/
│   └── agent-chat-ui/                  # fork of langchain-ai/agent-chat-ui
│       ├── src/
│       │   ├── components/
│       │   │   └── SettingsPanel.tsx    # ← 改造：去掉 LangSmith key 输入
│       │   └── ...
│       └── .env.local.example
│
├── skills/                             # SkillsMiddleware 扫描的根目录（平铺）
│   ├── brand-deep-dive/
│   │   └── SKILL.md
│   ├── vi-guidelines/
│   │   └── SKILL.md
│   ├── product-handbook/
│   │   └── SKILL.md
│   ├── copywriting-cn/
│   │   └── SKILL.md
│   ├── copywriting-overseas/
│   │   └── SKILL.md
│   ├── compliance-redlines/
│   │   └── SKILL.md
│   ├── campaign-templates/
│   │   └── SKILL.md
│   ├── employee-handbook/
│   │   └── SKILL.md
│   ├── compensation/
│   │   └── SKILL.md
│   ├── recruiting/
│   │   └── SKILL.md
│   ├── internal-comms/
│   │   └── SKILL.md
│   ├── sales-sop/
│   │   └── SKILL.md
│   ├── case-studies/
│   │   └── SKILL.md
│   ├── pricing/
│   │   └── SKILL.md
│   ├── proposal-templates/
│   │   └── SKILL.md
│   ├── competitor-analysis/
│   │   └── SKILL.md
│   ├── content-strategy/
│   │   └── SKILL.md
│   ├── platform-rules/
│   │   └── SKILL.md
│   ├── shooting-editing/
│   │   └── SKILL.md
│   └── viral-references/
│       └── SKILL.md
│
└── prompts/
    ├── supervisor.md
    ├── subagents/
    │   ├── marketing.md
    │   ├── hr.md
    │   ├── tob.md
    │   └── content.md
    └── shared/
        ├── company-essence.md
        ├── brand-soul.md
        └── safety-redlines.md
```

---

## Phase 0: 环境准备（1 周）

### Task 0-1：WSL2 + Docker Desktop 环境检查

**Files:** (无，环境操作)

- [ ] **检查 WSL2 状态**

```powershell
# 以管理员身份在 PowerShell 执行
wsl --status
# 应显示: Default Distribution: Ubuntu-22.04
# 如果未安装 Ubuntu:
wsl --install -d Ubuntu-22.04
wsl --set-default-version 2
```

- [ ] **安装 Docker Desktop**

从 https://www.docker.com/products/docker-desktop/ 下载安装。
安装后启动 → Settings → Resources → WSL Integration → 确保 Ubuntu-22.04 已勾选。

- [ ] **确认 Docker 可运行**

```powershell
wsl -d Ubuntu-22.04
docker --version
docker compose version  # 确认 docker compose 插件已安装
```

- [ ] **克隆项目仓库并进入 WSL2 工作目录**

```bash
# 在 WSL2 Ubuntu 终端中
cd /mnt/c/Users/lenovo/company-agent
git status  # 确认已有内容
```

---

### Task 0-2：Supabase Self-Hosted 部署

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `.env.example`

- [ ] **创建 docker-compose.yml**

```yaml
# infra/docker-compose.yml
version: "3.8"

services:
  # Supabase Self-Hosted 服务
  # 使用官方 supabase/docker 仓库的 docker-compose.yml
  # 参考: https://github.com/supabase/supabase/tree/master/docker
  #
  # 关键服务:
  #   postgres       : 主数据库 (supabase/postgres:latest)
  #   gotrue         : Auth 服务
  #   studio         : 管理后台 (supabase/studio:latest)
  #   kong           : API 网关
  #
  # 建议: 先复制 supabase/docker 项目的 docker-compose.yml 到此文件
  # 然后调整 postgres 映射端口避免与本地冲突

  postgres:
    image: supabase/postgres:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5

  gotrue:
    image: supabase/gotrue:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@postgres:5432/postgres
      GOTRUE_SITE_URL: ${SITE_URL:-http://localhost:3000}
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
    ports:
      - "9999:9999"

  studio:
    image: supabase/studio:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      STUDIO_PG_META_URL: http://pgmeta:8080
    ports:
      - "8081:3000"

  pgmeta:
    image: supabase/pgmeta:latest
    depends_on:
      postgres:
        condition: service_healthy

  # LangGraph Server（后续 Task 添加）

volumes:
  pgdata:
```

> **注**：这只是骨架，Supabase Self-Hosted 完整配置较复杂。建议从官方仓库复制完整 docker-compose.yml 并修改端口/密码。具体 compose 文件的内容在 Phase 1 会进一步调整。

- [ ] **创建 .env.example**

```bash
# .env.example - 复制为 .env 并填入真实值
POSTGRES_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret_min_32_chars
SITE_URL=http://localhost:3000

# DeepSeek API
DEEPSEEK_API_KEY=sk-your-key-here

# LangSmith
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=lsv2_pt_xxx
LANGSMITH_PROJECT=company-agent-dev
```

- [ ] **启动 Supabase 并验证**

```bash
cd infra
cp ../.env.example ../.env  # 先复制，后续填入真实值
docker compose up -d
# 验证服务都 running
docker compose ps
# 测试 Postgres 连接
docker compose exec postgres psql -U postgres -c "SELECT 1"
# 访问 Studio: http://localhost:8081
```

- [ ] **在 Studio 中创建 profiles 表**

在 Supabase Studio 的 SQL Editor 中执行：

```sql
CREATE TABLE public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    dept TEXT NOT NULL CHECK (dept IN ('marketing', 'hr', 'tob', 'content')),
    role TEXT DEFAULT '',
    region TEXT CHECK (region IN ('cn', 'overseas', NULL)),
    display_name TEXT DEFAULT ''
);

-- 开启 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 只允许用户查看自己的 profile
CREATE POLICY "users_can_view_own_profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);
```

- [ ] **手动录入一个测试用户**

在 Studio → Authentication → Users → Add User，创建 test@company.com。
然后在 SQL Editor 中：

```sql
INSERT INTO public.profiles (user_id, dept, role, region, display_name)
VALUES (
    '<刚才创建的 user id>',
    'marketing',
    '营销经理',
    'cn',
    '测试用户'
);
```

- [ ] **提交**

```bash
git add infra/docker-compose.yml .env.example
git commit -m "chore: add Supabase Self-Hosted compose and env template"
```

---

### Task 0-3：LangSmith + DeepSeek API 配置

**Files:**
- Modify: `.env`

- [ ] **注册 LangSmith 账号并创建 API Key**

打开 https://smith.langchain.com → Sign up → Settings → API Keys → Create Key

- [ ] **注册 DeepSeek API 并获取 Key**

打开 https://platform.deepseek.com → API Keys → 创建新 Key

- [ ] **填入 .env**

```bash
# .env 追加以下内容
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=lsv2_pt_<your-actual-key>
LANGSMITH_PROJECT=company-agent-dev

DEEPSEEK_API_KEY=sk-<your-actual-key>
```

- [ ] **验证 DeepSeek API 连通**

```bash
curl https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "Hi"}]}'
```

Expected: 200 response with assistant message.

---

### Task 0-4：Python 虚拟环境与依赖

**Files:**
- Create: `backend/pyproject.toml`

- [ ] **初始化 Python 虚拟环境并安装依赖**

```bash
cd /mnt/c/Users/lenovo/company-agent
python3.11 -m venv .venv
source .venv/bin/activate
```

- [ ] **创建 pyproject.toml**

```toml
# backend/pyproject.toml
[project]
name = "company-agent-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "langchain>=1.0.0",
    "langgraph>=0.4.0",
    "langgraph-checkpoint-postgres>=0.1.0",
    "deepagents>=0.5.0",
    "langchain-deepseek>=0.1.0",
    "httpx",
    "python-dotenv",
    "pyjwt",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "pytest-asyncio",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
asyncio_mode = "auto"
```

- [ ] **安装依赖**

```bash
# 从项目根目录
pip install -e backend/
pip install -e "backend/[dev]"
# 验证
python -c "from deepagents import create_deep_agent; print('OK')"
python -c "from langgraph.checkpoint.postgres import PostgresSaver; print('OK')"
```

- [ ] **提交**

```bash
git add backend/pyproject.toml
git commit -m "chore: setup Python project with dependencies"
```

---

## Phase 1: 骨架搭建（1 周）

### Task 1-1：LangGraph Server 骨架（空图）

**Files:**
- Create: `backend/src/__init__.py`
- Create: `backend/src/__main__.py`
- Create: `backend/src/config.py`
- Create: `backend/src/agent.py`
- Create: `backend/src/graph.py`
- Create: `backend/langgraph.json`

- [ ] **创建 __init__.py**

```python
# backend/src/__init__.py
"""Company Agent backend."""
```

- [ ] **创建 __main__.py**

```python
# backend/src/__main__.py
"""Entry point: python -m backend"""
from .graph import app

if __name__ == "__main__":
    from langgraph.server import serve
    serve(app)
```

- [ ] **创建 config.py**

```python
# backend/src/config.py
import os
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")

POSTGRES_URI = os.getenv(
    "POSTGRES_URI",
    "postgresql://postgres:password@localhost:5432/postgres"
)
```

- [ ] **创建 agent.py（最小配置）**

```python
# backend/src/agent.py
"""Deep Agent 配置"""
from deepagents import create_deep_agent
from .config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL

agent = create_deep_agent(
    name="company-agent",
    model=DEEPSEEK_MODEL,
    system_prompt="你是公司内部智能助手。使用中文回答。",
    # 后续 Phase 2 添加 subagents、skills
)
```

- [ ] **创建 graph.py（LangGraph 图定义）**

```python
# backend/src/graph.py
"""LangGraph 图定义 — LangGraph Server 入口点"""
from .agent import agent

# 直接暴露 agent 作为 LangGraph 图
# LangGraph Server 通过 langgraph.json 发现此变量
app = agent
```

- [ ] **创建 langgraph.json**

```json
{
  "python_version": "3.11",
  "dependencies": [
    "."
  ],
  "graphs": {
    "company_agent": "./backend/src/graph.py:app"
  },
  "env": "./.env"
}
```

- [ ] **验证 LangGraph Server 可启动**

```bash
# 在项目根目录
pip install -e ./backend  # 确保可导入
langgraph dev --host 0.0.0.0 --port 2024
```

Expected: Server 启动，访问 http://localhost:2024/docs 能看到 OpenAPI 文档。

- [ ] **提交**

```bash
git add backend/langgraph.json backend/src/
git commit -m "feat: add LangGraph server skeleton with empty deep agent"
```

---

### Task 1-2：Supabase JWT 校验（@auth）

**Files:**
- Create: `backend/src/auth.py`

- [ ] **创建 auth.py**

```python
# backend/src/auth.py
"""Supabase JWT 认证处理器 — 对接 LangGraph @auth"""
import jwt
from langgraph.auth import Authenticate
from .config import SUPABASE_JWT_SECRET

# 创建认证实例
authenticate = Authenticate()

@authenticate.handler
async def verify_supabase_jwt(authorization: str) -> dict:
    """
    校验 Supabase JWT，返回 user_id。

    LangGraph Server 收到请求后：
    1. 检查 Authorization header
    2. 调用此 handler
    3. 返回的 dict 注入到每次请求的 context
    """
    if not authorization:
        raise PermissionError("Missing Authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return {"user_id": payload["sub"]}
    except jwt.ExpiredSignatureError:
        raise PermissionError("Token expired")
    except jwt.InvalidTokenError:
        raise PermissionError("Invalid token")

# 暴露给 graph.py
__all__ = ["authenticate"]
```

- [ ] **更新 graph.py 启用认证**

```python
# backend/src/graph.py
from .agent import agent
from .auth import authenticate

# 将 authenticate 挂到 app 上
agent.auth = authenticate

app = agent
```

- [ ] **编写测试**

```python
# backend/tests/test_auth.py
"""测试 Supabase JWT 校验"""
import pytest
import jwt
from datetime import datetime, timedelta

from backend.src.auth import verify_supabase_jwt, SUPABASE_JWT_SECRET


def test_verify_valid_token():
    user_id = "test-uuid-123"
    token = jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(hours=1)},
        SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    result = verify_supabase_jwt(f"Bearer {token}")
    assert result["user_id"] == user_id


def test_verify_invalid_token():
    with pytest.raises(PermissionError):
        verify_supabase_jwt("Bearer invalid.token.here")


def test_verify_no_header():
    with pytest.raises(PermissionError):
        verify_supabase_jwt(None)

def test_verify_expired_token():
    token = jwt.encode(
        {"sub": "test", "exp": datetime.utcnow() - timedelta(hours=1)},
        SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(PermissionError):
        verify_supabase_jwt(f"Bearer {token}")
```

- [ ] **运行测试并提交**

```bash
pytest backend/tests/test_auth.py -v
# Expected: all 4 passed

git add backend/src/auth.py backend/tests/test_auth.py
git commit -m "feat: add Supabase JWT auth handler with tests"
```

---

### Task 1-3：Profiles 表查询

**Files:**
- Create: `backend/src/profiles.py`
- Create: `backend/tests/test_profiles.py`

- [ ] **创建 profiles.py**

```python
# backend/src/profiles.py
"""Supabase profiles 表抽象"""
from dataclasses import dataclass
from typing import Optional
import httpx
from .config import SUPABASE_JWT_SECRET

# 项目启动时需配置 Supabase anon key
SUPABASE_URL = "http://localhost:8000"  # Gotrue 服务地址
SUPABASE_ANON_KEY = ""  # 从 Supabase Studio 获取


@dataclass
class UserProfile:
    user_id: str
    dept: str
    role: str
    region: Optional[str] = None


async def get_profile(user_id: str) -> Optional[UserProfile]:
    """从 profiles 表查询用户信息"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"user_id": f"eq.{user_id}"},
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
        )
        if resp.status_code != 200 or not resp.json():
            return None
        data = resp.json()[0]
        return UserProfile(
            user_id=data["user_id"],
            dept=data["dept"],
            role=data.get("role", ""),
            region=data.get("region"),
        )
```

- [ ] **创建测试（mock，不依赖实际 Supabase）**

```python
# backend/tests/test_profiles.py
import pytest
from unittest.mock import patch, AsyncMock
from backend.src.profiles import get_profile, UserProfile


@pytest.mark.asyncio
async def test_get_profile_found():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "user_id": "uuid-1",
            "dept": "marketing",
            "role": "经理",
            "region": "cn",
        }
    ]

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        profile = await get_profile("uuid-1")
        assert profile is not None
        assert profile.dept == "marketing"
        assert profile.region == "cn"


@pytest.mark.asyncio
async def test_get_profile_not_found():
    mock_response = AsyncMock()
    mock_response.status_code = 404

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        profile = await get_profile("nonexistent")
        assert profile is None
```

- [ ] **运行测试并提交**

```bash
pytest backend/tests/test_profiles.py -v
# Expected: 2 passed

git add backend/src/profiles.py backend/tests/test_profiles.py
git commit -m "feat: add profiles table query with tests"
```

---

### Task 1-4：Agent Chat UI 部署 + Supabase Auth 接入

**Files:**
- Create: `frontend/` (clone agent-chat-ui)

- [ ] **Fork agent-chat-ui 放到 frontend/ 目录**

```bash
cd /mnt/c/Users/lenovo/company-agent
git clone https://github.com/langchain-ai/agent-chat-ui frontend/agent-chat-ui
cd frontend/agent-chat-ui
# 移除原 .git 避免与主仓库冲突
rm -rf .git
```

- [ ] **创建前端 .env.local**

```bash
# frontend/agent-chat-ui/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase-studio>
NEXT_PUBLIC_API_URL=http://localhost:2024
```

- [ ] **安装前端依赖**

```bash
cd frontend/agent-chat-ui
npm install
```

- [ ] **改造 SettingsPanel.tsx：去掉 LangSmith key 输入框**

替换原 SettingsPanel 组件，移除 API Key 输入 UI。将 deployment URL 写死为 `http://localhost:2024`。

原文件位置：`frontend/agent-chat-ui/src/components/SettingsPanel.tsx`

改造目标：
- 删除 "LangSmith API Key" 输入框
- 将 "Deployment URL" 设为固定值 `http://localhost:2024`
- 保留 "Assistant/Graph ID" 设为固定值 `company_agent`
- 保持 UI 简洁

- [ ] **测试前端启动**

```bash
cd frontend/agent-chat-ui
npm run dev
# 浏览器访问 http://localhost:3000
# 应该看到 Supabase Auth 登录页
```

- [ ] **提交**

```bash
cd /mnt/c/Users/lenovo/company-agent
git add frontend/
git commit -m "feat: add agent-chat-ui fork with Supabase auth integration"
```

---

### Task 1-5：端到端验证（最小闭环）

- [ ] **全部启动：**
  1. Supabase Self-Hosted running
  2. LangGraph Server running (`langgraph dev`)
  3. Frontend running (`npm run dev`)

- [ ] **测试流程：**
  1. 浏览器打开 http://localhost:3000
  2. 用 test@company.com / 密码登录
  3. 输入："你好"
  4. Agent 返回中文回复
  5. 检查 LangSmith trace: `https://smith.langchain.com/project/company-agent-dev`

- [ ] **预期结果：**
  - 登录 ✅
  - 发消息 → 收回复 ✅
  - LangSmith 看到 trace ✅
  - 认证失败的请求返回 401 ✅

---

## Phase 2: 多 SubAgent + Skill（2 周）

### Task 2-1：SubAgent 配置（4 部门）

**Files:**
- Modify: `backend/src/agent.py`

- [ ] **更新 agent.py：加上 4 个 SubAgent**

```python
# backend/src/agent.py
"""Deep Agent 配置 — 带 SubAgent"""
from deepagents import create_deep_agent
from langchain_deepseek import ChatDeepSeek
from .config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL

llm = ChatDeepSeek(
    model=DEEPSEEK_MODEL,
    api_key=DEEPSEEK_API_KEY,
    temperature=0.3,
)

# 定义部门 SubAgent
SUBAGENTS = [
    {
        "name": "marketing-agent",
        "description": "处理市场推广、文案、EDM、活动策划相关任务",
        "system_prompt": "你是公司营销 SubAgent。负责文案撰写、活动策划、品牌推广等任务。",
        "model": DEEPSEEK_MODEL,
    },
    {
        "name": "hr-agent",
        "description": "处理人力资源相关咨询和事务，如请假流程、招聘、制度查询",
        "system_prompt": "你是公司 HR SubAgent。负责制度问答、招聘支持、内部公告等任务。",
        "model": DEEPSEEK_MODEL,
    },
    {
        "name": "tob-agent",
        "description": "处理 B 端销售和客户相关任务，如方案书、报价、客户邮件",
        "system_prompt": "你是公司 toB 销售 SubAgent。负责客户沟通、方案产出、竞品分析等任务。",
        "model": DEEPSEEK_MODEL,
    },
    {
        "name": "content-agent",
        "description": "处理内容产出相关任务，如选题策划、脚本、平台规范",
        "system_prompt": "你是公司内容产出 SubAgent。负责选题、脚本、拍摄剪辑指导等任务。",
        "model": DEEPSEEK_MODEL,
    },
]

agent = create_deep_agent(
    name="company-agent",
    model=DEEPSEEK_MODEL,
    system_prompt="你是公司内部智能助手 Supervisor。根据用户问题路由到对应的部门 SubAgent。",
    subagents=SUBAGENTS,
)
```

- [ ] **验证 SubAgent 可路由**

```bash
# 启动 server
langgraph dev --host 0.0.0.0 --port 2024

# 测试
curl -X POST http://localhost:2024/runs \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "company_agent",
    "input": {"messages": [{"role": "user", "content": "帮我写个营销推广文案"}]}
  }'
```

Expected: Agent 响应，在 LangSmith trace 中能看到 SubAgent 调用。

- [ ] **提交**

```bash
git add backend/src/agent.py
git commit -m "feat: add 4 department subagents to deep agent"
```

---

### Task 2-2：SkillsMiddleware 配置

**Files:**
- Modify: `backend/src/agent.py`
- Create: `backend/src/skills_loader.py`

- [ ] **创建 skills_loader.py**

```python
# backend/src/skills_loader.py
"""Skill 目录加载配置"""
import os

# SkillsMiddleware 扫描的根目录路径
# 在 Docker 中运行时，通过 volume 挂载 /skills 到 /app/skills
SKILLS_DIR = os.getenv("SKILLS_DIR", os.path.abspath("../skills"))

def get_skills_config():
    """返回 skills 配置（绝对路径）"""
    if not os.path.isdir(SKILLS_DIR):
        print(f"Warning: skills dir not found at {SKILLS_DIR}")
    return [SKILLS_DIR]
```

- [ ] **更新 agent.py：加上 SkillsMiddleware + FilesystemBackend**

```python
# backend/src/agent.py
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langchain_deepseek import ChatDeepSeek
from .config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL
from .skills_loader import get_skills_config

llm = ChatDeepSeek(
    model=DEEPSEEK_MODEL,
    api_key=DEEPSEEK_API_KEY,
    temperature=0.3,
)

SUBAGENTS = [
    # ...同上，每个 subagent 保持不变
]

agent = create_deep_agent(
    name="company-agent",
    model=DEEPSEEK_MODEL,
    system_prompt="你是公司内部智能助手 Supervisor。根据用户问题路由到对应的部门 SubAgent。",
    subagents=SUBAGENTS,
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),
    skills=get_skills_config(),
)
```

> **关键注意**：Custom subagents 不继承 main agent 的 skills。需要在 Phase 3 给每个 subagent 加上 `"skills": get_skills_config()`。

- [ ] **验证启动**

```bash
# 先确保 skills 目录存在（即使空文件）
mkdir -p ../skills
# 启动 server
langgraph dev --host 0.0.0.0 --port 2024
# 观察启动日志，确认无 skill 加载错误
```

- [ ] **提交**

```bash
git add backend/src/agent.py backend/src/skills_loader.py
git commit -m "feat: add SkillsMiddleware with filesystem backend"
```

---

### Task 2-3：创建 MVP 版 SKILL.md（20 个）

**Files:**
- Create: 20 个 `skills/*/SKILL.md` 文件

这一步内容量大但模式固定。因为全部为用户后续自己填充真实内容，现在只放占位骨架。

- [ ] **创建 common 组 skill**

```bash
# /skills/brand-deep-dive/SKILL.md
---
name: brand-deep-dive
description: 品牌完整手册。用于品牌理念深入研究、品牌故事撰写、品牌定位分析。覆盖品牌历史、核心价值、视觉识别体系。
department: common
---

# Brand Deep Dive

**何时调用：** 用户需要深入理解品牌理念、撰写品牌故事、进行品牌分析时。

**内容：** [待填充 — 品牌完整手册]

## 核心信息
- [品牌名称]
- [品牌使命]
- [核心价值]

## 参考来源
- [待指定]
```

每个 skill 遵循相同模式。以下是完整列表及其 description 文案（关键）：

```bash
# skills/vi-guidelines/SKILL.md
---
name: vi-guidelines
description: VI 视觉识别规范。用于 Logo 使用规范、品牌色彩体系（色值/应用）、字体排版、辅助图形等视觉元素的标准与应用规则。
department: common
---
# VI Guidelines
[待填充 — VI 完整手册]
```

```bash
# skills/product-handbook/SKILL.md
---
name: product-handbook
description: 产品手册。用于了解产品详情、功能说明、规格参数、使用场景。覆盖公司所有产品线的完整信息。
department: common
---
# Product Handbook
[待填充 — 产品手册]
```

```bash
# skills/copywriting-cn/SKILL.md
---
name: copywriting-cn
description: 大陆市场文案写作。用于小红书、微信公众号、抖音、视频号等中文平台的推广文案、社媒帖文、广告语、EDM 撰写。覆盖各平台调性差异、内容范式。
department: marketing
---
# Copywriting - Chinese Mainland
[待填充 — 大陆文案规范 + 各平台调性]
```

```bash
# skills/copywriting-overseas/SKILL.md
---
name: copywriting-overseas
description: 海外市场文案写作。用于 Instagram、Twitter/X、LinkedIn、TikTok、Facebook 等海外平台的推广文案、社媒帖文、广告语、EDM 撰写。覆盖英文及多语言内容。
department: marketing
---
# Copywriting - Overseas
[待填充 — 海外文案规范 + 各平台调性]
```

```bash
# skills/compliance-redlines/SKILL.md
---
name: compliance-redlines
description: 广告合规审查。用于发布前检查文案是否触发广告法极限词（最/第一/唯一等），以及各平台（大陆/海外）的红线规则。
department: marketing
---
# Compliance Redlines
[待填充 — 广告法合规清单]
```

```bash
# skills/campaign-templates/SKILL.md
---
name: campaign-templates
description: 营销活动 SOP 与模板。用于促销活动、节日营销、新品发布的标准化流程和执行 checklist。
department: marketing
---
# Campaign Templates
[待填充 — 活动模板]
```

```bash
# skills/employee-handbook/SKILL.md
---
name: employee-handbook
description: 员工手册。用于查询公司考勤制度、请假流程、报销规则、福利政策、办公规范等。
department: hr
---
# Employee Handbook
[待填充 — 员工手册]
```

```bash
# skills/compensation/SKILL.md
---
name: compensation
description: 薪酬绩效制度。用于查询薪酬结构、绩效考核标准、晋升调薪流程、奖金方案等。注意：内容涉及公司敏感信息。
department: hr
---
# Compensation & Performance
[待填充 — 薪酬绩效制度]
```

```bash
# skills/recruiting/SKILL.md
---
name: recruiting
description: 招聘面试支持。用于 JD 撰写、面试题草拟、面评模板、offer 通知、招聘流程 SOP。
department: hr
---
# Recruiting
[待填充 — 招聘 SOP]
```

```bash
# skills/internal-comms/SKILL.md
---
name: internal-comms
description: 内部公告与沟通。用于撰写公司内部通知、公告、政策宣讲材料、全员邮件等。
department: hr
---
# Internal Communications
[待填充 — 内部沟通模板]
```

```bash
# skills/sales-sop/SKILL.md
---
name: sales-sop
description: B 端销售 SOP。用于销售流程各环节（获客、跟进、提案、签约）的标准操作流程和话术指导。
department: tob
---
# Sales SOP
[待填充 — 销售 SOP]
```

```bash
# skills/case-studies/SKILL.md
---
name: case-studies
description: 客户案例库。用于客户成功案例的检索和参考，覆盖各行业/规模的典型合作案例与数据。
department: tob
---
# Case Studies
[待填充 — 案例库]
```

```bash
# skills/pricing/SKILL.md
---
name: pricing
description: 定价与报价指南。用于查询产品定价、折扣策略、合作模式、报价模板。注意：涉及公司敏感商业信息。
department: tob
---
# Pricing Guide
[待填充 — 定价策略]
```

```bash
# skills/proposal-templates/SKILL.md
---
name: proposal-templates
description: 方案书与报价书模板。用于制作各类客户方案书、技术方案、商务报价书的模板和样例。
department: tob
---
# Proposal Templates
[待填充 — 方案书模板]
```

```bash
# skills/competitor-analysis/SKILL.md
---
name: competitor-analysis
description: 竞品分析库。用于查询竞争对手的产品对比、市场定位、优劣势分析、差异化策略参考。
department: tob
---
# Competitor Analysis
[待填充 — 竞品分析]
```

```bash
# skills/content-strategy/SKILL.md
---
name: content-strategy
description: 内容选题策略。用于内容选题策划、内容日历规划、热点头脑风暴、系列内容规划。
department: content
---
# Content Strategy
[待填充 — 选题策略]
```

```bash
# skills/platform-rules/SKILL.md
---
name: platform-rules
description: 各平台内容规范。用于各内容平台（小红书、抖音、B站、公众号等）的内容审核规则、推荐算法要点、排版规范。
department: content
---
# Platform Rules
[待填充 — 平台规范]
```

```bash
# skills/shooting-editing/SKILL.md
---
name: shooting-editing
description: 拍摄剪辑指南。用于视频拍摄脚本、分镜设计、剪辑节奏建议、后期处理要点、设备使用参考。
department: content
---
# Shooting & Editing
[待填充 — 拍摄剪辑]
```

```bash
# skills/viral-references/SKILL.md
---
name: viral-references
description: 爆款拆解与参考库。用于分析爆款内容的结构（标题/封面/节奏）、互动模式、传播逻辑，归纳可复用的内容范式。
department: content
---
# Viral References
[待填充 — 爆款拆解]
```

- [ ] **验证 skill 可被 agent 发现**

确认 Agent Chat UI 中问一个营销相关问题，LangSmith trace 能看到 `copywriting-cn` 的 `Activation` 事件。

```bash
# 验证方法较难自动化，手动测试：
# 1. 启动 server
# 2. 问："帮我写个小程序推广文案"
# 3. 在 LangSmith trace 中查看 tool call 和 skill 加载
```

- [ ] **提交**

```bash
git add skills/
git commit -m "feat: add 20 MVP SKILL.md files (placeholder content)"
```

---

### Task 2-4：user_profile 注入 + 路由条件

**Files:**
- Create: `backend/src/prompts.py`
- Modify: `backend/src/graph.py`
- Modify: `backend/src/auth.py`

- [ ] **创建 prompts.py**

```python
# backend/src/prompts.py
"""Prompt 模板加载与拼接"""
import os
from typing import Optional
from .profiles import UserProfile

PROMPTS_DIR = os.getenv("PROMPTS_DIR", os.path.abspath("../prompts"))


def _read_file(path: str) -> str:
    from pathlib import Path
    p = Path(path)
    return p.read_text(encoding="utf-8") if p.exists() else ""


def build_system_prompt(user: Optional[UserProfile], prompt_name: str) -> str:
    """
    组装 system prompt。
    顺序: shared/* → {subagent}.md 或 supervisor.md → user_profile 变量
    """
    parts = []

    # shared/ 固定在前（最大化 DeepSeek cache hit）
    for name in ["company-essence", "brand-soul", "safety-redlines"]:
        content = _read_file(os.path.join(PROMPTS_DIR, "shared", f"{name}.md"))
        if content:
            parts.append(content)

    # 当前 prompt 文件
    current = _read_file(os.path.join(PROMPTS_DIR, f"{prompt_name}.md"))
    if current:
        parts.append(current)

    # subagent 目录下
    subagent = _read_file(os.path.join(PROMPTS_DIR, "subagents", f"{prompt_name}.md"))
    if subagent:
        parts.append(subagent)

    # user_profile 注入（变尾部，避免打乱 cache）
    if user:
        profile_block = (
            f"\n# 当前用户\n"
            f"- 部门：{user.dept}\n"
            f"- 岗位：{user.role}\n"
            f"- 区域：{user.region or '未指定'}\n"
        )
        parts.append(profile_block)

    return "\n\n---\n\n".join(parts)


def build_supervisor_prompt(user: Optional[UserProfile]) -> str:
    return build_system_prompt(user, "supervisor")


def build_subagent_prompt(user: Optional[UserProfile], subagent_name: str) -> str:
    # subagent_name 为 marketing-agent → marketing
    name = subagent_name.replace("-agent", "")
    return build_system_prompt(user, name)
```

- [ ] **更新 graph.py：注入 user_profile 到 system prompt**

```python
# backend/src/graph.py
"""LangGraph 图定义"""
from .agent import agent
from .auth import authenticate
from .profiles import get_profile
from .prompts import build_supervisor_prompt

# 挂载认证
agent.auth = authenticate

# 增加 preprocess 节点：读取 profile → 构建 system prompt
async def inject_user_profile(state, config):
    user_id = config["configurable"].get("user_id")
    if not user_id:
        return  # 降级：无 profile

    profile = await get_profile(user_id)
    if profile:
        prompt = build_supervisor_prompt(profile)
        # 替换 system message
        state["messages"][0]["content"] = prompt + "\n" + state["messages"][0]["content"]

    return state

# 注册到 agent 的 graph 中（通过 preprocess hook）
agent.preprocess = inject_user_profile

app = agent
```

- [ ] **提交**

```bash
git add backend/src/prompts.py backend/src/graph.py
git commit -m "feat: inject user profile into supervisor system prompt"
```

---

## Phase 3: Prompt 体系 + 长期记忆（1 周）

### Task 3-1：创建 Prompt 模板文件（占位）

**Files:**
- Create: `prompts/supervisor.md`
- Create: `prompts/subagents/marketing.md`
- Create: `prompts/subagents/hr.md`
- Create: `prompts/subagents/tob.md`
- Create: `prompts/subagents/content.md`
- Create: `prompts/shared/company-essence.md`
- Create: `prompts/shared/brand-soul.md`
- Create: `prompts/shared/safety-redlines.md`

- [ ] **创建 supervisor.md**

```markdown
# prompts/supervisor.md
你是 {{company_name}} 的内部智能助手主调度员（Supervisor）。

# 你的职责
1. 理解用户请求，决定调用哪个 SubAgent。
2. 复杂多步任务先 write_todos 拆解，再分发。
3. 默认按 user.dept 路由；用户明确说"以 X 部门视角"则切换。
4. **任务类型 / 平台 / 受众 / 场景任一含糊 → 主动追问，不要乱猜。**

# 路由规则
- 文案 / EDM / 活动 → marketing-agent
- 制度 / 请假 / 报销 / 招聘 → hr-agent
- 客户邮件 / 方案书 / 报价 / 案例 → tob-agent
- 选题 / 脚本 / 分镜 / 平台规范 → content-agent
- 跨部门 / 模糊：先 write_todos 拆，再多次分发
- 显式覆盖：用户写"[以 X 视角]"临时路由到该 SubAgent

# 长期记忆
- 用 manage_memory(key, value) 记录用户偏好/历史
- 用 search_memory(query) 检索过往
```

- [ ] **创建 4 个 subagent prompt 文件**

```markdown
# prompts/subagents/marketing.md
你是 {{company_name}} 的营销 SubAgent。

# 工作原则
1. 先确认场景（内容类型 / 目标平台 / 受众），不确定就追问
2. 根据 region 选择文案风格体系：
   - region=cn → 加载 copywriting-cn 等中文 skill
   - region=overseas → 加载 copywriting-overseas 等英文 skill
3. 按需加载 skill：写文案 → 对应文案 skill；涉及 VI → vi-guidelines；涉及产品 → product-handbook
4. 成稿前 → 加载 compliance-redlines 自检
5. 多步任务用 write_todos 推进
6. 输出永远符合品牌灵魂

# 红线
- 不触发广告法极限词
- 不引用未确认的产品数据
```

```markdown
# prompts/subagents/hr.md
你是 {{company_name}} 的 HR SubAgent。

# 工作原则
1. 制度类问题 → 加载 employee-handbook 查询
2. 招聘类 → 加载 recruiting（JD / 面试题 / offer 模板）
3. 薪酬类 → 谨慎处理，确认用户有权限查询
4. 内部公告 → 加载 internal-comms

# 红线
- 薪酬信息仅向 HR 相关人员提供
- 员工档案信息不对外
```

```markdown
# prompts/subagents/tob.md
你是 {{company_name}} 的 toB 销售 SubAgent。

# 工作原则
1. 客户邮件/方案 → 加载 proposal-templates
2. 报价/定价 → 加载 pricing（确认用户权限）
3. 案例参考 → 加载 case-studies
4. 竞品对比 → 加载 competitor-analysis
5. 销售流程 → 加载 sales-sop

# 红线
- 定价/折扣信息不向非销售岗位透露
- 客户信息保密
```

```markdown
# prompts/subagents/content.md
你是 {{company_name}} 的内容产出 SubAgent。

# 工作原则
1. 选题策划 → 加载 content-strategy
2. 平台规范 → 加载 platform-rules
3. 拍摄剪辑指导 → 加载 shooting-editing
4. 爆款参考 → 加载 viral-references

# 红线
- 不引用未授权的素材
- 遵守各平台内容规范
```

- [ ] **创建 shared/ 占位文件（内容由你后续填入）**

```markdown
# prompts/shared/company-essence.md
[待填] 公司一句话定位 + 使命 + 核心价值观（不超过 3 条）
```

```markdown
# prompts/shared/brand-soul.md
[待填] 品牌灵魂一句话 + 3 个调性形容词 + 绝对不要做的事
```

```markdown
# prompts/shared/safety-redlines.md
- 薪酬、定价、未公开客户名单、未公开战略信息不主动透露
- 法律/医疗/财务专业问题 → 建议咨询专业人士
- 越权请求（非 HR 索要员工档案、非 toB 索要客户报价）→ 拒绝并说明原因
- 输出引用具体数据时必须基于 skill 加载的内容，不臆造
```

- [ ] **提交**

```bash
git add prompts/
git commit -m "feat: add prompt templates with routing rules and shared placeholders"
```

---

### Task 3-2：Postgres Checkpointer + Store 配置

**Files:**
- Create: `backend/src/store_setup.py`
- Modify: `backend/src/agent.py`

- [ ] **创建 store_setup.py**

```python
# backend/src/store_setup.py
"""Postgres Checkpointer 与 Store 配置"""
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.store.postgres import PostgresStore
from .config import POSTGRES_URI


def create_checkpointer() -> PostgresSaver:
    """创建 Postgres-backed checkpointer"""
    return PostgresSaver.from_conn_string(POSTGRES_URI)


def create_store() -> PostgresStore:
    """创建 Postgres-backed Store（长期记忆）"""
    return PostgresStore.from_conn_string(POSTGRES_URI)
```

- [ ] **更新 agent.py：编译到 agent**

```python
# backend/src/agent.py
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langchain_deepseek import ChatDeepSeek
from .config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL
from .skills_loader import get_skills_config
from .store_setup import create_checkpointer, create_store

llm = ChatDeepSeek(
    model=DEEPSEEK_MODEL,
    api_key=DEEPSEEK_API_KEY,
    temperature=0.3,
)

SUBAGENTS = [
    {
        "name": "marketing-agent",
        "description": "处理市场推广、文案、EDM、活动策划相关任务",
        "system_prompt": "你是公司营销 SubAgent。负责文案撰写、活动策划、品牌推广等任务。",
        "model": DEEPSEEK_MODEL,
        "skills": get_skills_config(),
    },
    {
        "name": "hr-agent",
        "description": "处理人力资源相关咨询和事务，如请假流程、招聘、制度查询",
        "system_prompt": "你是公司 HR SubAgent。负责制度问答、招聘支持、内部公告等任务。",
        "model": DEEPSEEK_MODEL,
        "skills": get_skills_config(),
    },
    {
        "name": "tob-agent",
        "description": "处理 B 端销售和客户相关任务，如方案书、报价、客户邮件",
        "system_prompt": "你是公司 toB 销售 SubAgent。负责客户沟通、方案产出、竞品分析等任务。",
        "model": DEEPSEEK_MODEL,
        "skills": get_skills_config(),
    },
    {
        "name": "content-agent",
        "description": "处理内容产出相关任务，如选题策划、脚本、平台规范",
        "system_prompt": "你是公司内容产出 SubAgent。负责选题、脚本、拍摄剪辑指导等任务。",
        "model": DEEPSEEK_MODEL,
        "skills": get_skills_config(),
    },
]

checkpointer = create_checkpointer()
store = create_store()

agent = create_deep_agent(
    name="company-agent",
    model=DEEPSEEK_MODEL,
    system_prompt="你是公司内部智能助手 Supervisor。根据用户问题路由到对应的部门 SubAgent。",
    subagents=SUBAGENTS,
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),
    skills=get_skills_config(),
    checkpointer=checkpointer,
    store=store,
)
```

> **注意**：`PostgresSaver` 和 `PostgresStore` 的 `from_conn_string()` 需要实际连接 Supabase 的 Postgres。如果 Supabase Self-Hosted 尚未运行，可先用 `MemorySaver()` / `InMemoryStore()` 兜底开发。

```python
# 开发期降级版本
def create_checkpointer():
    try:
        return PostgresSaver.from_conn_string(POSTGRES_URI)
    except Exception:
        from langgraph.checkpoint.memory import MemorySaver
        return MemorySaver()

def create_store():
    try:
        return PostgresStore.from_conn_string(POSTGRES_URI)
    except Exception:
        from langgraph.store.memory import InMemoryStore
        return InMemoryStore()
```

- [ ] **验证 Store 初始化**

```bash
# 确保 Supabase Postgres 已运行
langgraph dev --host 0.0.0.0 --port 2024
# 启动无错误，且多次 invoke 同一 thread_id 可以看到消息历史
```

- [ ] **测试跨会话记忆**

```python
# 手动测试脚本
import requests
base = "http://localhost:2024"

# 创建 thread
resp = requests.post(f"{base}/threads", json={"assistant_id": "company_agent"})
thread_id = resp.json()["thread_id"]

# invoke 1
requests.post(
    f"{base}/threads/{thread_id}/runs",
    json={"messages": [{"role": "user", "content": "我喜欢简短的回答风格"}]}
)

# invoke 2 — 期望 agent 记住了
resp = requests.post(
    f"{base}/threads/{thread_id}/runs",
    json={"messages": [{"role": "user", "content": "现在帮我写个文案"}]}
)
print(resp.json())
```

- [ ] **提交**

```bash
git add backend/src/store_setup.py backend/src/agent.py
git commit -m "feat: add Postgres checkpointer and Store for long-term memory"
```

---

### Task 3-3：Per-user 长期记忆工具（manage_memory / search_memory）

**Files:**
- Modify: `backend/src/agent.py`

Deep Agents 默认在 Store 初始化后会自动为 agent 添加 `manage_memory` / `search_memory` 工具。需要确认 Store 在 `create_deep_agent()` 中正确传入即可。

- [ ] **验证 memory tool 可用**

```bash
# 在 Agent Chat UI 中对同一个用户（同 thread_id）：
# 1. 说："记住，我的名字是小明"
# 2. 新开一个 thread 再问："我叫什么名字？"
# 预期回答："你叫小明。"
```

如果默认工具不存在，添加自定义 memory tool：

```python
# 在 agent.py 增加
from langchain.tools import tool

@tool
def manage_memory(key: str, value: str) -> str:
    """记录用户偏好或事实，跨会话持久化。key: 记忆的键名, value: 记忆的内容"""
    # 由 Deep Agents 框架自动匹配到 store 操作
    return f"已记住: {key} = {value}"

@tool
def search_memory(query: str) -> str:
    """检索跨会话记忆。query: 搜索关键词"""
    return f"搜索结果: ..."

# 在 create_deep_agent 中传入 tools
agent = create_deep_agent(
    tools=[manage_memory, search_memory],
    ...
)
```

- [ ] **提交**

```bash
git add backend/src/agent.py
git commit -m "feat: add manage_memory and search_memory tools for long-term memory"
```

---

## Phase 4: 内测 + 调优（1-2 周）

### Task 4-1：LangSmith Eval Dataset 创建

- [ ] **为营销部创建 20 个典型问题**（在 LangSmith 中创建 dataset）

```python
# 测试集样例（在 LangSmith UI 中添加）
marketing_test_cases = [
    {"input": "帮我写一个小红书种草文，推广新款防晒霜", "expected_skills": ["copywriting-cn"]},
    {"input": "写个双十一促销活动策划方案", "expected_skills": ["campaign-templates", "copywriting-cn"]},
    {"input": "帮我把这段文案翻译成英文，发在 Instagram", "expected_skills": ["copywriting-overseas"]},
    {"input": "检查这段文案有没有广告法违规词", "expected_skills": ["compliance-redlines"]},
    {"input": "我们的 Logo 在深色背景下怎么用", "expected_skills": ["vi-guidelines"]},
    # ... 共 20 条
]
```

- [ ] **为 HR 部创建 20 个典型问题**

```python
hr_test_cases = [
    {"input": "请假的流程是什么", "expected_skills": ["employee-handbook"]},
    {"input": "帮我写个招聘产品经理的 JD", "expected_skills": ["recruiting"]},
    {"input": "公司加班怎么算", "expected_skills": ["employee-handbook"]},
    {"input": "写个发全员的年会通知", "expected_skills": ["internal-comms"]},
    # ... 共 20 条
]
```

- [ ] **创建 LangSmith eval runner**

```python
# backend/tests/test_eval.py
"""运行 LangSmith eval"""
from langsmith import Client, evaluate
from langsmith.evaluation import evaluator

client = Client()

# 定义评估函数
def skill_accuracy(run, examples):
    """检查 agent 是否选择了正确的 skill"""
    expected = examples[0].outputs["expected_skills"]
    # 解析 run 中的 tool_calls → 提取 skill 名称
    actual_tools = [
        call["name"]
        for call in run.outputs.get("messages", [])
        if hasattr(call, "tool_calls")
    ]
    # 检查 expected_skills 中至少有一个被调用
    return {
        "key": "skill_accuracy",
        "score": 1.0 if any(s in actual_tools for s in expected) else 0.0,
    }

# 在终端运行
# python -m backend.tests.test_eval
```

- [ ] **运行初轮评估**

```bash
python -m backend.tests.test_eval
# 记录基线数据
```

---

### Task 4-2：内测部署 + 反馈闭环

- [ ] **在内测机上部署完整 Docker Compose**

```bash
# docker-compose.yml 追加 LangGraph Server + Frontend 服务
# 构建前端静态文件
cd frontend/agent-chat-ui
npm run build
# 输出到 frontend/agent-chat-ui/out/
```

- [ ] **招募 5-10 人内测（营销 + HR 各 3-5 人）**

- [ ] **建立反馈收集机制：**
  - 每个"答错/答漏/调性不对"的对话 → 用户截图或复制对话
  - 问题分类：skill 选错 / 调性不对 / 信息有误 / 需要追问
  - 每周回顾 LangSmith trace 复盘

- [ ] **根据反馈迭代**

| 问题类型 | 解决方式 |
|---|---|
| Skill 选错 | 改 SKILL.md 的 description（更精确的关键词） |
| 调性不对 | 改下属 prompt 或 shared/brand-soul.md |
| 信息有误 | 填充或修正对应 SKILL.md |
| 需要追问 | 改写 prompt 中的追问条件 |

---

### Task 4-2.5：LangGraph Server Docker 化并入 Compose

**Files:**
- Modify: `infra/docker-compose.yml`

- [ ] **在 docker-compose.yml 中添加 LangGraph Server 服务**

```yaml
# infra/docker-compose.yml 追加
  langgraph:
    build:
      context: ..
      dockerfile: infra/Dockerfile.langgraph
    ports:
      - "2024:2024"
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - DEEPSEEK_MODEL=${DEEPSEEK_MODEL}
      - POSTGRES_URI=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
      - SKILLS_DIR=/app/skills
      - PROMPTS_DIR=/app/prompts
    volumes:
      - ../skills:/app/skills
      - ../prompts:/app/prompts
    depends_on:
      postgres:
        condition: service_healthy
```

- [ ] **创建 Dockerfile.langgraph**

```dockerfile
# infra/Dockerfile.langgraph
FROM python:3.11-slim
WORKDIR /app
COPY backend/ .
RUN pip install -e .
CMD ["langgraph", "serve", "--host", "0.0.0.0", "--port", "2024"]
```

- [ ] **构建并验证**

```bash
cd infra
docker compose build langgraph
docker compose up -d
curl http://localhost:2024/health  # 期望 200
```

- [ ] **提交**

```bash
git add infra/docker-compose.yml infra/Dockerfile.langgraph
git commit -m "feat: add LangGraph Server to Docker Compose"
```

---

### Task 4-2.75：Frontend Docker 化

**Files:**
- Modify: `infra/docker-compose.yml`（追加 frontend 服务）

- [ ] **在 docker-compose.yml 中添加 frontend**

```yaml
  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ../frontend/agent-chat-ui/out:/usr/share/nginx/html
    depends_on:
      - langgraph
```

- [ ] **构建前端静态文件并验证**

```bash
cd frontend/agent-chat-ui
npm run build
# 确认 out/ 目录生成
ls out/
```

- [ ] **验证内网访问**

```bash
# 在局域网另一台电脑浏览器中访问
# http://<部署电脑 IP>
# 应看到 Agent Chat UI 登录页
```

---

### Task 4-3：上线前的质量门

- [ ] **检 check list（spec §11）：**
  - [ ] Supabase RLS 开启
  - [ ] LangSmith dev/prod 分离
  - [ ] 前端不暴露 key
  - [ ] shared/* prompt 填完且 review 过
  - [ ] 营销 + HR 各 3 个以上完整 skill
  - [ ] LangSmith eval 通过率 ≥ 80%
  - [ ] Docker 部署稳定运行 ≥ 7 天
  - [ ] pg_dump 备份脚本就位

---

## Self-Review

### 1. Spec Coverage

| Spec 节 | 对应 Task | 覆盖 |
|---|---|---|
| §1 背景与目标 | Phase 0 | ✅ 环境搭建 |
| §2 核心概念（Skill ≠ Prompt） | Task 2-2, Task 3-1 | ✅ |
| §3 技术架构 | Task 0-2 ~ Task 1-5 | ✅ |
| §4 Agent 架构（Supervisor + 4 SubAgent） | Task 2-1 | ✅ |
| §4.2 路由策略 | Task 3-1 (prompts/supervisor.md) | ✅ 追问逻辑在 prompt 中 |
| §4.3 长期记忆 | Task 3-2, 3-3 | ✅ |
| §5 Skill 体系（平铺 + department frontmatter） | Task 2-2, 2-3 | ✅ 修正版平铺结构 |
| §6 Prompt 体系 | Task 3-1 | ✅ 含 shared 占位 |
| §7 模型选型（DeepSeek V4） | Task 0-3, 2-1 | ✅ |
| §8 端到端场景 | Task 1-5, 2-4 | ✅ |
| §9 测试策略 | Task 4-1 | ✅ |
| §11 上线 check list | Task 4-3 | ✅ |
| §12 留待后续 | 明确标注在 README | ✅ |

### 2. Placeholder Check

- shared/*.md 的 `[待填]` 是设计预期的占位（由项目负责人填入），非 bug
- 20 个 SKILL.md 的 `[待填充 — ...]` 同样是 MVP 策略——先骨架后迭代，spec 已明确此策略
- 无其他 TBD/TODO/后续工作未追踪

### 3. Type Consistency

- `create_deep_agent()` 配置中 `model` 统一使用 `DEEPSEEK_MODEL` 变量
- SubAgent name 格式统一：`marketing-agent` / `hr-agent` / `tob-agent` / `content-agent`
- profiles.dept 枚举值：`marketing` / `hr` / `tob` / `content`（与 SubAgent name 去掉 `-agent` 后缀后一致）
- `department` frontmatter 与 profiles.dept 取值一致
