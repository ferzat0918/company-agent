# Company Agent

公司内部智能体 — 面向全员提供基于公司知识资产的 AI 协作助手。

## 部署（任何一台机器，5 分钟）

只需要装好 Docker，整个项目可直接跑起来。**不需要 Python、不需要 Node.js**。

### 1. 前置条件

- Docker Desktop（[官网下载](https://www.docker.com/products/docker-desktop)），装好后确保右下角图标是绿色
- Git
- 至少 20 GB 空闲磁盘

> **国内用户**：Docker Desktop 装好后先配镜像加速。
> Settings → Docker Engine → 把 JSON 里加上：
> ```json
> "registry-mirrors": [
>   "https://docker.1ms.run",
>   "https://docker.m.daocloud.io",
>   "https://docker.1panel.live"
> ]
> ```
> 点 Apply & Restart。

### 2. 拉代码

```
git clone https://github.com/ferzat0918/company-agent.git
cd company-agent
```

### 3. 配置 `.env`

```
cp .env.example .env
```

打开 `.env` 改这 5 行（其它都有合理默认值）：

| 变量 | 怎么填 |
|------|--------|
| `POSTGRES_PASSWORD` | 任何强密码 |
| `JWT_SECRET` | 任何 ≥32 字符的随机字符串 |
| `SUPABASE_ANON_KEY` | 找管理员要，或参考 Supabase 文档生成 |
| `DEEPSEEK_API_KEY` | DeepSeek 官网申请 |
| `SITE_URL` | 这台机器对外的地址，如 `http://192.168.1.100` |

### 4. 启动

```
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

第一次会下载几 GB 镜像，等 5-30 分钟（看网速）。

### 5. 访问

浏览器打开 `http://<这台机器的IP>`，即可使用。让局域网内的其他人也用同一个地址。

### 防火墙

如果别人访问不了，在那台机器的 Windows 防火墙放行 **80 端口**。

---

## 更新

```
cd company-agent
git pull
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

镜像有变化会自动拉新的，配置变化会重启对应容器，**已有数据不丢**。

---

## 公网访问（Cloudflare Tunnel）

如果想让公司外的人也能用（手机、出差），通过 Cloudflare Tunnel 暴露到公网，**不需要公网 IP、不需要动路由器**。

前提：你的域名已经托管在 Cloudflare（nameserver 指向 Cloudflare）。

> Cloudflare 的 UI 经常改名换路径，下面是 2026-05 的写法。如果某个菜单找不到，按关键词在 dashboard 搜一下：`Tunnels`、`Published application routes`、`Access applications`。

### Step 1：创建隧道，拿 token

1. 打开 [one.dash.cloudflare.com](https://one.dash.cloudflare.com)（Zero Trust 后台）
2. 左侧 **Networks → Connectors → Cloudflare Tunnels** → **Create a tunnel**
3. Connector 类型选 `Cloudflared` → 起个名（如 `company-agent`）→ Save
4. 接下来显示一段 `docker run ... --token eyJ...` 的命令 → **只复制 `--token` 后面那一长串** `eyJ...`（**不要**真的去执行那条命令，你会通过 docker compose 来跑）

### Step 2：配公开路由

5. 创建完隧道，回到 **Networks → Connectors → Cloudflare Tunnels** 列表，找到你刚建的 → 点 **Edit**（不是点名字进去看）
6. 切到 **Published application routes** 标签 → **Add a published application route**
7. 填：
   - Subdomain: `agent`（或你想要的）
   - Domain: `umxlab.com`
   - Service Type: `HTTP`
   - URL: `frontend:80`
   - Path: **留空**
8. Save。Cloudflare 自动给 `agent.umxlab.com` 加 CNAME。

### Step 3：加访问控制（强烈推荐）

9. 左侧 **Access controls → Applications** → **Create new application** → **Self-hosted**
10. **Add public hostname** → Domain 下拉里选 `agent.umxlab.com`
11. Application name: 任意；Session Duration: 24 hours 或随意
12. Next → 新建一条 Policy：
    - Policy name: 任意（如 `umxlab-employees`）
    - Action: Allow
    - Selector: `Emails ending in`，Value: `@umxlab.com` —— 或者用 `Emails` 加具体邮箱
13. 一路 Next → Add application

### Step 4：在部署的电脑改 `.env`

```
CLOUDFLARED_TOKEN=eyJ...（Step 1 第 4 步复制的那串）
SITE_URL=https://agent.umxlab.com
```

然后：

```
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

docker 会自动重建 cloudflared 和 gotrue 容器以应用新配置。

### Step 5：验证

打开 `https://agent.umxlab.com`：
1. 先看到 Cloudflare Access 邮箱验证（输放行邮箱 → 收 OTP → 输验证码）
2. 通过后才能进登录页
3. 用 Supabase 账号登录 → 正常用

> 不想用公网？把 `CLOUDFLARED_TOKEN` 留空，cloudflared 容器自己退出，LAN 部署不受影响。

---

## 远程管理 Supabase（可选）

Supabase Studio 默认在 LAN 上可访问：`http://<host>:8081`（**自身没有登录**，所以**绝对不要直接暴露到公网**）。

如果你想在外网也能改库，按照"公网访问"那一节再加一条路由，但 **Access policy 务必只放行你自己的邮箱**（不要用通配符）：
- Subdomain: `studio`
- URL: `studio:3000`
- Access policy: Selector = `Emails`，Value = 你的邮箱（**不要**用 `Emails ending in`）

---

## 架构

- **Agent 编排**：LangGraph + Deep Agents（Supervisor → 4 SubAgents）
- **LLM**：DeepSeek
- **前端**：agent-chat-ui (Next.js 静态导出)
- **API 网关 + Auth + DB + Storage**：Supabase self-hosted（Kong / GoTrue / Postgres / Storage）
- **流量入口**：nginx → kong → 各服务（浏览器只感知一个 origin）
- **可观测**：LangSmith（可选）

```
┌────────────┐
│  浏览器     │ http://host
└─────┬──────┘
      │
┌─────▼──────────────────────────────┐
│  nginx (port 80)                    │
│   /                → 前端静态文件     │
│   /auth/v1/*       → kong            │
│   /storage/v1/*    → kong            │
│   /agent/v1/*      → kong (SSE)      │
└────────────────────────────────────┘
      │
      │  docker network
      ▼
┌─────────────────────────────────────┐
│  kong → gotrue / storage / langgraph │
│  langgraph → postgres                │
└─────────────────────────────────────┘
```

## 目录结构

```
company-agent/
├── .env                    # 环境变量（每台机器独立维护，不进 git）
├── .env.example            # 模板
├── langgraph.json          # LangGraph 入口
├── backend/                # LangGraph Server (Python)
├── frontend/               # agent-chat-ui (Next.js)
│   └── agent-chat-ui/out/  # 预 build 的静态文件（已进 git）
├── skills/                 # Agent Skills
├── prompts/                # System Prompt 模板
├── infra/                  # docker-compose / Dockerfile / nginx / kong
└── docs/                   # 设计文档
```

## Skill 结构

所有 skill 文件夹平铺在 `/skills/` 下一层。部门归属通过 SKILL.md frontmatter 的 `department` 字段定义。

```markdown
---
name: copywriting-cn
description: 大陆市场文案写作
department: marketing
---
```

## 开发者：本地修改前端

如果要修改前端代码，需要 Node.js 18+。

```
cd frontend/agent-chat-ui
npm install
npm run dev    # 开发模式，热重载
# 或
npm run build  # 生产构建，输出到 out/
```

提交前请**运行一次 `npm run build`** 并把新的 `out/` 一起提交，这样别人 clone 后可以零环境直接跑。

## 设计文档

- 设计稿：`docs/superpowers/specs/2026-05-09-company-agent-design.md`
- 实施计划：`docs/superpowers/plans/2026-05-09-company-agent-plan.md`
