# Company Agent

公司内部智能体 — 面向全员提供基于公司知识资产的 AI 协作助手。

## 架构概览

- **Agent 编排**: LangGraph + Deep Agents (Supervisor → 4 SubAgents)
- **LLM**: DeepSeek V4 Flash (主力) / V4 Pro (升级)
- **前端**: agent-chat-ui (Next.js)
- **Auth + DB**: Supabase Self-Hosted
- **可观测**: LangSmith
- **部署**: 公司内网, Windows 11 + WSL2 + Docker Desktop

## 目录结构

```
company-agent/
├── .env                    # 唯一环境变量 (git-ignored)
├── .env.example            # 模板
├── langgraph.json          # LangGraph Server 入口配置
│
├── backend/                LangGraph Server 代码 (Python)
│   ├── src/
│   └── tests/
├── frontend/               Agent Chat UI (Next.js)
│   └── agent-chat-ui/
├── skills/                 Agent Skills (SKILL.md 平铺)
├── prompts/                System Prompt 模板
├── infra/                  Docker Compose / 部署脚本
└── docs/                   设计文档
```

## 快速开始

### 前置条件

- Windows 11 + WSL2 (Ubuntu 22.04)
- Docker Desktop (WSL2 integration enabled)
- Python 3.11+
- Node.js 18+

### 1. 环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入:

| 变量 | 说明 |
|---|---|
| POSTGRES_PASSWORD | 数据库密码 |
| JWT_SECRET | JWT 密钥 (≥32 字符) |
| DEEPSEEK_API_KEY | DeepSeek API key |
| LANGSMITH_API_KEY | LangSmith API key (可选开发用) |
| SUPABASE_ANON_KEY | 从 Supabase Studio 获取 |

### 2. 启动数据库

```bash
cd infra
docker compose --env-file ../.env up -d
# 首次启动后访问 http://localhost:8081 (Supabase Studio)
# 创建 auth.users, 并在 SQL Editor 中执行:
```

```sql
CREATE TABLE public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    dept TEXT NOT NULL CHECK (dept IN ('marketing', 'hr', 'tob', 'content')),
    role TEXT DEFAULT '',
    region TEXT CHECK (region IN ('cn', 'overseas', NULL)),
    display_name TEXT DEFAULT ''
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_can_view_own_profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);
```

### 3. 启动后端

```bash
# Python 依赖
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# 启动 LangGraph Server
cd ..
langgraph dev --host 0.0.0.0 --port 2024
```

### 4. 启动前端

```bash
cd frontend/agent-chat-ui
cp .env.local.example .env.local  # 编辑填入配置
npm install
npm run dev
```

访问 http://localhost:3000

### 5. Docker 全栈部署

```bash
cd infra
docker compose --env-file ../.env up -d --build
# 访问 http://<内网 IP>
```

## Skill 结构

所有 skill 文件夹平铺在 `/skills/` 下一层 (SkillsMiddleware 只扫描直接子文件夹)。
部门归属通过 SKILL.md frontmatter 的 `department` 字段定义。

```markdown
---
name: copywriting-cn
description: 大陆市场文案写作。用于小红书、微信公众号等平台。
department: marketing
---
```

```
/skills/
├── brand-deep-dive/     department: common
├── copywriting-cn/      department: marketing
├── employee-handbook/   department: hr
├── sales-sop/           department: tob
├── content-strategy/    department: content
└── ...
```

## Prompts 体系

```
/prompts/
├── supervisor.md              主路由 prompt
├── subagents/                  4 个部门 SubAgent prompt
│   ├── marketing.md
│   ├── hr.md
│   ├── tob.md
│   └── content.md
└── shared/
    ├── company-essence.md      [待填] 公司定位
    ├── brand-soul.md           [待填] 品牌灵魂
    └── safety-redlines.md      安全红线
```

## 上线前待办

- [ ] 填写 `prompts/shared/company-essence.md` — 公司一句话定位 + 使命
- [ ] 填写 `prompts/shared/brand-soul.md` — 品牌灵魂 + 调性形容词
- [ ] 填充各 `skills/*/SKILL.md` 的正文内容 (当前为占位骨架)
- [ ] 在 Supabase Studio 中录入员工账号和 profiles
- [ ] 配置 Kong 网关 (infra/kong.yml 为开发最小配置)
- [ ] 部署前锁定 infra/docker-compose.yml 中所有镜像版本 (移除 :latest)
- [ ] 配置 pg_dump 定时备份
- [ ] 内测评估: 每部门 20 个典型问题, LangSmith eval 通过率 ≥ 80%

## 观测 (LangSmith)

- Dev 项目: https://smith.langchain.com/project/company-agent-dev
- Prod 项目: https://smith.langchain.com/project/company-agent-prod
- 用于: trace 调试, prompt playground, eval dataset, LLM-as-judge 评估

## 设计文档

详见 `docs/superpowers/specs/2026-05-09-company-agent-design.md`
实施计划: `docs/superpowers/plans/2026-05-09-company-agent-plan.md`
