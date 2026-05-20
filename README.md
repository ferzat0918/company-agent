# 
![UMX Company Agent Banner](docs/assets/readme_banner.png)

<div align="center">

`// HIGH-END AESTHETICS / ATMOSPHERIC AI COOPERATION PLATFORM`

### 🛸 UMX 公司内部智能体系统
**面向全员提供基于公司知识资产的先锋级 AI 协作助手**

[部署说明](#-一键部署) • [公网暴露](#-公网访问cloudflare-tunnel) • [系统架构](#-系统架构) • [入口面板](#-后台管理页面入口汇总仪表盘)

</div>

---

## 🧭 后台管理页面入口汇总（仪表盘）

项目集成了非常完整的数据链路与可观测网关组件。为了解决服务入口多、端口繁杂的问题，以下为您梳理了全套系统的**中心控制面板清单**：

| 控制台名称 | 访问入口 | 认证要求 | 目标受众 | 核心管理职责 / 数据流向 |
| :--- | :--- | :--- | :--- | :--- |
| **💬 智能体聊天客户端**<br>*(Chat UI)* | 👉 `http://localhost` *(Port 80)* | `GoTrue` 企业账号登录 | **公司全员** | 日常办公聊天、AI 写作协作、调用部门特定技能包（Skills）。 |
| **⚙️ 智能体业务后台**<br>*(System Admin)* | 👉 `http://localhost/admin` | 管理员权限账号 | **系统管理员** | 汇总查看用户反馈、管理智能体版本、审核会话历史审计日志。 |
| **🔌 Kong 网关控制台**<br>*(Kong Manager)* | 👉 `http://localhost:8002` *(Port 8002)* | 局域网免密 / 可开启 Key-Auth | **运维与开发 (DevOps)** | **【完全动态可编辑】** 实时可视化增删改查微服务路由、调整超时阈值、动态绑定限流/降级插件。 |
| **🗄️ Supabase 应用看板**<br>*(Supabase Studio)* | 👉 `http://localhost:8081` *(Port 8081)* | 内网免密 (公网建议 SSH 隧道) | **后端开发与 DBA** | 可视化设计数据库表结构、管理 RLS 安全策略、查看用户列表数据、管理云存储桶中用户上传的附件。 |
| **👁️ 大模型应用追踪中心**<br>*(LangSmith)* | 👉 [smith.langchain.com](https://smith.langchain.com) | LangChain 平台云端认证 | **AI 研发 / 提示词工程师** | **【AI 可观测性】** 实时监控并回放 LangGraph 智能体的执行步骤，可视化分析每一步 Token 消耗与深度思考耗时。 |

> [!WARNING]
> **安全警示：** `Supabase Studio (8081)` 和 `Kong Manager (8002)` 默认无鉴权即可操作，**绝对不要直接向公网暴露这两个端口**！如有外网调试需求，请务必参考 [远程管理 Supabase](#远程管理-supabase可选) 章节添加 Cloudflare Access 身份验证隔离网关。

---

## ⚡ 一键部署（5 分钟上跑）

项目已实现全面容器化。您只需装好 Docker，即可零环境配置、零依赖直接启动整个系统。

### 1. 前置条件
* 安装 **Docker Desktop**（[官网下载](https://www.docker.com/products/docker-desktop)），安装后确保状态图标为绿色。
* 安装 **Git**。
* 确保本地至少有 **20 GB** 的空闲磁盘空间。

> [!TIP]
> **国内加速优化：** 安装 Docker 后建议配置国内加速器以提高拉取速度。
> 打开 Settings → Docker Engine，在 JSON 配置中加入：
> ```json
> "registry-mirrors": [
>   "https://docker.1ms.run",
>   "https://docker.m.daocloud.io",
>   "https://docker.1panel.live"
> ]
> ```
> 点击 **Apply & Restart** 即可生效。

### 2. 获取代码与配置
```bash
git clone https://github.com/ferzat0918/company-agent.git
cd company-agent
cp .env.example .env
```

打开新建的 `.env` 配置文件，修改以下 5 项关键变量（其余参数皆有安全合理的默认值）：

| 变量键名 | 填充说明 |
| :--- | :--- |
| `POSTGRES_PASSWORD` | 设置您的 PostgreSQL 数据库管理员强密码 |
| `JWT_SECRET` | 填写一个包含大写/小写/数字、长度不少于 32 位的强密钥字符串 |
| `SUPABASE_ANON_KEY` | 填入项目的 Supabase Anon 客户端公钥 |
| `DEEPSEEK_API_KEY` | 您的 DeepSeek 官方 API 密钥 (用于驱动 AI 思考与执行) |
| `SITE_URL` | 本台物理服务器对局域网公开的访问 IP 地址，例如 `http://192.168.1.100` |

### 3. 一键启动命令
```bash
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```
> **提示：** 首次启动时会拉取并编译底层镜像，根据网速耗时大约 5 ~ 15 分钟。运行结束后，请在浏览器中直接访问物理机配置的 `SITE_URL` 即可立即开启使用！

### 4. 日常在线更新
当您拉取了最新的仓库代码后，只需执行以下命令，系统会自动重建升级变动的容器，**且已有的数据库数据绝对不会丢失**：
```bash
cd company-agent
git pull
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

---

## 🌐 公网访问（Cloudflare Tunnel 极速穿透）

如果需要让出差员工、外部协作者或移动端能从外网安全地访问本智能体系统，我们推荐使用内置的 **Cloudflare Tunnel**。**无需公网 IP，无需配置路由器端口映射！**

### Step 1：创建隧道并获取 Token
1. 登录并打开 [one.dash.cloudflare.com](https://one.dash.cloudflare.com)（Zero Trust 控制台）。
2. 在左侧菜单点击 **Networks → Connectors → Cloudflare Tunnels** → **Create a tunnel**。
3. 容器类型选择 `Cloudflared`，为隧道起名（如 `company-agent`）后点击 **Save**。
4. 页面将显示一段 `docker run ... --token eyJ...` 命令，**请只复制 `--token` 之后长串的秘钥文本** `eyJ...`（无需执行命令，我们将通过 Compose 自动拉起运行）。

### Step 2：映射公开的二级域名
5. 返回 Tunnels 隧道列表，点击刚才创建的隧道右侧的 **Edit**。
6. 切到 **Published application routes** 标签页 → 点击 **Add a published application route**。
7. 填写映射路由信息：
   * **Subdomain**: `agent` *(或者您喜爱的二级域名)*
   * **Domain**: 您的域名（如 `umxlab.com`）
   * **Service Type**: `HTTP`
   * **URL**: `frontend:80` *(指向 Nginx 代理容器的内网地址)*
8. 点击 **Save**，Cloudflare 将自动在您的 DNS 列表中生成 CNAME 智能解析记录。

### Step 3：添加企业级身份验证安全伞（强烈推荐）
9. 在 Zero Trust 左侧菜单点击 **Access controls → Applications** → **Create new application** → 选择 **Self-hosted**。
10. 在 **Add public hostname** 下拉框中，绑定您的二级域名：`agent.umxlab.com`。
11. 配置 Policy 访问控制策略：
    * **Action**: `Allow`
    * **Selector**: `Emails ending in`，**Value**: `@umxlab.com` *(限制仅允许后缀为公司企业邮箱的员工登录访问)*。
12. 确认并创建，实现双重验证隔离。

### Step 4：部署机环境更新并重构
修改本地部署机上的 `.env` 文件：
```env
CLOUDFLARED_TOKEN=eyJ... # 填入 Step 1 复制的长串 Token
SITE_URL=https://agent.umxlab.com # 升级为您公网访问的 https 地址
```
执行启动命令，重建服务网关：
```bash
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

---

## 🔒 远程管理 Supabase（安全加固）

由于 **Supabase Studio (Port 8081)** 是完全开放的数据库控制面板，**严禁在无隔离保护下直接暴露到外网**。
若要在外网通过网页管库，建议按照上面的“公网访问”逻辑，增加一条独立路由：
* **Subdomain**: `studio` *(如 `studio.umxlab.com`)*
* **URL**: `studio:3000`
* **Access Policy**: **必须**设置为 `Selector = Emails` 且 `Value = 您的私人邮箱`（**不要**使用公司后缀通配符，仅允许您个人邮箱进行管理员二次验证登录）。

---

## 🏗️ 系统架构

整个系统基于**“边缘代理 + 微服务安全网关 + 多智能体编排”**的三层动态架构打造。所有外部浏览器流量首先经由 `Nginx` 进行 Origin 同源分发解决跨域问题，随后通过 `Kong` 网关将请求动态分发至不同的 API 服务器。

```mermaid
graph TD
    Browser[浏览器 client] -->|Port 80| Nginx[Nginx Edge 反向代理]
    
    subgraph Edge Layer (同源分发网关)
        Nginx -->|/ 或 /changelog| NextJS[Next.js 编译静态文件]
        Nginx -->|/skills/*| SkillsDisk[本地 Skills 磁盘资产]
        Nginx -->|/auth/v1/*, /rest/v1/*, /agent/v1/*| Kong[Kong API 动态网关]
    end
    
    subgraph Microservices Layer (微服务安全网关)
        Kong -->|JWT 校验与身份认证| Gotrue[Supabase GoTrue Auth]
        Kong -->|Postgres 数据库 API 自动生成| Postgrest[PostgREST Engine]
        Kong -->|云文件管理与上传| Storage[Supabase Storage API]
        Kong -->|大模型 Agent 流式通信 (SSE)| LangGraph[LangGraph Agent Server]
    end

    subgraph Data & Agent Engine (数据与大模型引擎)
        Gotrue --> DB[(PostgreSQL Database)]
        Postgrest --> DB
        Storage --> DB
        LangGraph --> DB
        LangGraph -->|实时追踪分析| LangSmith[LangSmith SaaS Observability]
    end
```

---

## 📂 目录结构总览

```bash
company-agent/
├── .env                    # 环境变量（每台机器独立维护，严禁提交到 git）
├── .env.example            # 统一的环境变量标准模板
├── langgraph.json          # LangGraph 服务端核心图声明
├── backend/                # Python 智能体服务 (LangGraph Agent Logic)
│   ├── src/                # 智能体核心节点、工具（Tools）、存储设计源码
│   └── tests/              # 后端核心单元与集成测试用例
├── frontend/               # Next.js 用户聊天前端 (agent-chat-ui)
│   └── agent-chat-ui/out/  # 预编译生成的静态资源目录 (已提交 Git 以保开箱即用)
├── skills/                 # 多智能体技能定义包目录 (各部门 Skills)
├── prompts/                # 大模型 System Prompt 提示词模板 markdown
├── docs/                   # 产品规格书与开发文档
│   └── assets/             # 存放 README 横幅与系统截图等视觉资产
└── infra/                  # Dockerfile、docker-compose 及 nginx、kong 配置文件目录
```

---

## 🛠️ 技能模块（Skills）标准

在 `/skills/` 目录下，您可以随意添加新的智能体技能包。各部门的权限与描述遵循 `SKILL.md` 的 frontmatter 规范来进行自动装载：

```markdown
---
name: copywriting-cn
description: 大陆市场先锋文案写作与美学策划
department: marketing
---
```

---

## 💻 前端开发指引

如果前端研发需要进行代码修改、新增页面路由或改动交互，需确保您的宿主机具有 Node.js 18+ 环境：

```bash
cd frontend/agent-chat-ui
pnpm install
pnpm dev    # 启动开发服务器，支持热重载调试
# 或
pnpm build  # 进行生产环境静态打包，结果输出至 out/ 目录
```
> [!IMPORTANT]
> **团队协作提交规范：**
> 在您修改完前端代码并提交 Git 仓库前，**请务必在本地运行一次 `pnpm build`**，并将生成的最新 `out/` 静态导出目录一起提交。这能确保其他团队成员拉取最新代码后，不需要本地配置 Node/pnpm 环境即可一键通过 Docker 直接跑起来！
