# 公司内部智能体（Company Agent）设计文档

- **创建日期**：2026-05-09
- **作者**：项目负责人 + Claude（brainstorming 协作）
- **状态**：Spec v1（待用户复核 → 进入实施计划）

---

## 1. 背景与目标

### 1.1 业务背景

公司有多个职能部门：产品研发、产品设计、市场营销与推广（含**海外市场**与**大陆市场**两个团队）、内容产出、拍摄剪辑、人力资源等。每个部门日常都需要在公司既有的**品牌理念、VI 手册、产品手册、各类规章制度**框架下完成工作产出，但这些资料分散、查阅成本高、产出风格容易跑偏。

### 1.2 目标

构建一个面向公司全员的内部 Agent：

1. **识别使用者身份**（部门、岗位、区域），自动以对应视角与权限协助
2. **掌握公司全部知识资产**（品牌理念、VI、产品手册、规章制度等），以 Anthropic Agent Skills 标准的"按需加载"机制组织
3. **自动调度合适的部门 SubAgent** 处理任务，输出符合公司调性的内容
4. **per-user 长期记忆**——记住每位员工的偏好与历史交付物
5. 部署在**公司内网**，员工通过浏览器访问

### 1.3 首期试点

MVP 4 个部门 SubAgent 同时上线（marketing / hr / tob / content），但**深度试点先聚焦"营销 + HR"**，其余两个一期搭好骨架，二期内测后再深度跑。

---

## 2. 核心概念澄清

### 2.1 Skill ≠ Prompt（关键区分）

| 类型 | 性质 | 加载时机 | 内容 |
|---|---|---|---|
| **System Prompt** | 静态、永远在上下文 | session 开始注入 | 角色定义、公司核心定位、品牌灵魂（精炼版）、行为约束 |
| **Skill** | 动态、按需加载 | 模型自主决定（基于 description） | 具体任务模板、平台规范、流程 SOP、详细手册 |

**所有 skill 都是按需加载的，无"常驻 skill"**。常驻能力归 prompt 范畴，与 skill 完全分离管理。

### 2.2 Anthropic Agent Skills 三级渐进披露

| 阶段 | 加载内容 |
|---|---|
| ① Discovery（启动） | 所有 skill 的 `name + description`（仅元信息） |
| ② Activation（命中） | 该 skill 的 `SKILL.md` 全文 |
| ③ Execution（深入） | SKILL.md 引用的子文件 / 脚本 |

由 LangGraph 的 `SkillsMiddleware` 实现，与 LLM 解耦。

---

## 3. 技术架构

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────────────────┐
│  前端：langchain-ai/agent-chat-ui（fork & 改造）               │
│  · Next.js 14，开箱即用：流式 + 工具调用渲染                    │
│  · 嵌入 Supabase Auth UI（员工登录）                            │
│  · 改造点：去掉 client-side LangSmith key 输入；deployment URL │
│    写死成局域网地址                                             │
└─────────────────────────────┬────────────────────────────────┘
                              │ Supabase JWT (Authorization header)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  LangGraph Server（langgraph-cli 自部署）                      │
│  · @auth.authenticate：校验 Supabase JWT → 注入 user_id       │
│  · 从 Supabase profiles 表读 dept/role/region                 │
│  · 内置 HTTP/SSE API（threads / runs / store）                │
│  · 自动 trace 到 LangSmith                                    │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Agent 编排：LangGraph + Deep Agents                          │
│  Supervisor → SubAgent×4 → SkillsMiddleware                   │
│  Checkpointer = PostgresSaver  ┐                              │
│  Store        = PostgresStore  ├─→ 都连 Supabase Postgres     │
└─────────────────────────────┬─┘                              │
                              │
        ┌─────────────────────┴──────────────────────┐
        ▼                                            ▼
┌─────────────────────────────┐               ┌──────────────────┐
│  Supabase Self-Hosted       │               │  Skills（git 仓库）│
│  · auth.users               │               │  /skills/         │
│  · public.profiles          │               │   ├ common/      │
│    (user_id, dept, role,    │               │   ├ marketing/   │
│     region) + RLS           │               │   ├ hr/          │
│  · public.checkpoints       │               │   ├ tob/         │
│  · public.checkpoint_writes │               │   └ content/     │
│  · public.store (LangGraph) │               │  每个 skill 文件夹：│
└─────────────────────────────┘               │  SKILL.md +      │
                                              │  reference.md … │
观测 / 调试 / 评测：LangSmith（云）            └──────────────────┘
```

### 3.2 部署形态（v1：全本地，公司内网）

```
┌─────────────────────────────────────────────────┐
│ 公司空闲电脑 1 台                                 │
│ Windows 11 + WSL2 + Docker Desktop              │
│ 推荐配置：4C8G+，硬盘 ≥ 100GB                     │
│                                                 │
│ Docker Compose 同台跑：                          │
│ ┌──────────────────────────────────────────┐   │
│ │ Supabase Self-Hosted Stack                │   │
│ │  · Postgres / GoTrue / Studio / Kong …    │   │
│ └──────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────┐   │
│ │ LangGraph Server                          │   │
│ │  + /skills/ 目录挂载（git clone）         │   │
│ │  + /prompts/ 目录挂载                     │   │
│ └──────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────┐   │
│ │ 前端 Next.js（pnpm build → 静态）         │   │
│ └──────────────────────────────────────────┘   │
│ Caddy 反代（纯 HTTP，内网无需 HTTPS）             │
│ 局域网 IP：192.168.x.x                          │
└─────────────────────────────────────────────────┘
       ▲                              │
       │ 员工浏览器走内网              │ 出网调 LLM
       │                              ▼
       │                    ┌──────────────────────┐
公司其他电脑                │ DeepSeek API         │
                            │ api.deepseek.com     │
                            └──────────────────────┘
                            ┌──────────────────────┐
                            │ LangSmith trace 出网 │
                            │ smith.langchain.com  │
                            └──────────────────────┘
```

**Anthropic API / Claude 不使用**。LangChain 的 `init_chat_model` 配置允许后期切换。

#### 3.2.1 Windows + WSL2 端口转发说明

Docker Desktop 在 Windows 11 默认基于 WSL2 运行，所有容器实际跑在 WSL2 虚拟机内。员工从局域网访问 `192.168.x.x:port` 时，Windows 主机需把该端口转发到 WSL2 内的 Docker。

**两种实现方式（实施阶段任选）：**

1. **Docker Desktop 端口映射**（最简）：`docker-compose.yml` 里 `ports: "0.0.0.0:80:80"`，Docker Desktop 会自动转发到 Windows 网络层，局域网可直达
2. **Windows `netsh portproxy`**（适合 WSL2 内裸跑服务）：`netsh interface portproxy add v4tov4 listenport=80 connectaddress=<wsl2-ip>` —— 需要每次 WSL2 重启后重设（或写脚本开机执行）

推荐方式 1，零配置。

**额外注意**：Windows 防火墙默认阻外部入站，需要为相关端口加入站规则（开发期手动加，生产期写 PowerShell 脚本固化）。

---

## 4. Agent 架构（LangGraph + Deep Agents）

### 4.1 组件拓扑

```
┌────────────────────────────────────────────────┐
│  Supervisor Agent（主路由）                     │
│  · system prompt 注入 user_profile             │
│  · write_todos：拆 todo                         │
│  · SubAgentMiddleware：派任务                   │
│  · manage_memory / search_memory（独占）         │
└─┬──────────┬──────────┬──────────┬─────────────┘
  │          │          │          │
marketing-  hr-       tob-      content-
 agent      agent     agent      agent
  │          │          │          │
┌─▼──────────▼──────────▼──────────▼─────────┐
│  SkillsMiddleware（progressive disclosure） │
│  全部按需加载，无常驻                        │
└────────────────────────────────────────────┘
```

### 4.2 路由策略

**核心原则：宁可追问，不可乱猜。**

任意一项含糊 → 主动追问而非乱路由：
- 任务类型（写什么 / 查什么 / 改什么）含糊
- 目标平台 / 受众 / 场景含糊
- 跨部门归属不明
- 用户身份特殊（临时以其他部门视角）

明确后路由表：

| 任务类型 | 目标 SubAgent |
|---|---|
| 文案 / 海报文 / EDM / 活动 | `marketing-agent` |
| 制度 / 请假 / 报销 / 招聘 | `hr-agent` |
| 客户邮件 / 方案 / 报价 / 案例 | `tob-agent` |
| 选题 / 脚本 / 分镜 / 平台规范 | `content-agent` |

**显式覆盖**：用户写"[以 X 视角]"临时路由到该 SubAgent。
**跨部门多步任务**：`write_todos` 拆解后分发。
**海外/大陆**：不拆 SubAgent，由 `user.region` 参数驱动 marketing / tob 内分支。

### 4.3 长期记忆（per-user）

| 模块 | 实现 |
|---|---|
| 短期会话状态 | `PostgresSaver`（Supabase Postgres） |
| 长期跨会话记忆 | `PostgresStore`（同库），`namespace=("user", user_id)` |
| 暴露方式 | tool：`manage_memory(key, value)` / `search_memory(query)` |
| 开放范围 | **仅 Supervisor 可读写**。SubAgent 不直接动 Store，由 Supervisor 统管 |

---

## 5. Skill 体系

### 5.1 目录结构（全部按需加载）

```
/skills/
├── common/                    ← 跨部门共享
│   ├── brand-deep-dive/       品牌完整手册
│   ├── vi-guidelines/         完整 VI 规范
│   └── product-handbook/      产品详情
│
├── marketing/
│   ├── copywriting-cn/        大陆文案（按平台拆子文件）
│   ├── copywriting-overseas/  海外文案
│   ├── compliance-redlines/   广告法 + 平台政策红线
│   └── campaign-templates/    活动 SOP
│
├── hr/
│   ├── employee-handbook/
│   ├── compensation/          （前期靠 prompt 限定权限）
│   ├── recruiting/
│   └── internal-comms/
│
├── tob/
│   ├── sales-sop/
│   ├── case-studies/
│   ├── pricing/               （同上）
│   ├── proposal-templates/
│   └── competitor-analysis/
│
└── content/
    ├── content-strategy/
    ├── platform-rules/
    ├── shooting-editing/
    └── viral-references/
```

### 5.2 SKILL.md 范例

> **注**：以下范例为 skill 完整成熟态的结构演示（含子文件引用）。**MVP 阶段每个 skill 仅有 SKILL.md，无子文件**（见 §5.4）；范例中的 `platforms/*.md` 与 `examples/` 仅在二期 skill 扩展时出现。

`/skills/marketing/copywriting-cn/SKILL.md`：

```markdown
---
name: copywriting-cn
description: 大陆市场文案写作。用于小红书、微信公众号、抖音、视
  频号等中文平台的推广文案、社媒帖文、广告语、邮件 EDM 撰写。
  覆盖各平台调性差异、内容范式和广告法合规检查。
---

# 大陆市场文案写作

## 何时调用
（撰写或润色面向中国大陆市场的：小红书笔记 / 公众号 / 抖音脚本 /
推广文案 / 广告语 / 邮件 EDM / 活动文案 …）

## 写作流程
1. 确认平台（不明则追问）
2. 加载平台子文件（platforms/{xiaohongshu,wechat-public,douyin}.md）
3. 加载产品信息（common/product-handbook 对应章节）
4. 成稿前检查 compliance-redlines

## 调性原则
- 第二人称为主，避免空洞口号
- 数据/具体细节 > 形容词
- 利益点先行
- 平台原生表达：小红书重"种草"，公众号重"叙事"，抖音重"勾子"

## 常见错误
- ❌ 海外品牌话术腔（直译感）
- ❌ 引用未确认的产品数据
- ❌ 触发广告法极限词

## 子文件
- platforms/*.md：各平台范式
- examples/：历史精选稿件
```

### 5.3 frontmatter 规范

| 字段 | 规则 |
|---|---|
| `name` | 短横线小写，全局唯一，建议 `{部门}-{动作}` 形式 |
| `description` | **关键，决定召回准确率**。动词开头，列出"用于 X、Y、Z" 场景，50–150 字 |

### 5.4 内容产出策略

**MVP**：每个 skill 一页 SKILL.md，**不带子文件**。上线后通过用户反馈和 LangSmith trace 决定哪些 skill 优先扩展子文件。

**上线流程**：开发或运营在 git repo 改 SKILL.md → PR → review → merge → CI 部署 LangGraph server 重启加载。**非技术员工通过"运营接口人"代提 PR**。

---

## 6. Prompt 体系

### 6.1 目录与拼接顺序

```
/prompts/
├── supervisor.md              主路由
├── subagents/
│   ├── marketing.md
│   ├── hr.md
│   ├── tob.md
│   └── content.md
└── shared/                    被各 prompt 用 {{ include }} 拼接
    ├── company-essence.md     公司一句话定位 + 使命（精炼）
    ├── brand-soul.md          品牌灵魂（精炼，非完整手册）
    └── safety-redlines.md     通用红线
```

**拼接顺序**（每次会话开始组装）：
```
[shared/company-essence] + [shared/brand-soul]
  + [当前 prompt 文件本体]
  + [shared/safety-redlines]
  + [user_profile 变量注入]
```

**为最大化 DeepSeek 缓存命中**：上述稳定 prefix 永远放最前面，user_profile 与动态 SKILL.md 放后面。

### 6.2 Supervisor Prompt 范例

```markdown
你是 {{company_name}} 的内部智能助手主调度员（Supervisor）。

# 公司
{{include: shared/company-essence}}

# 品牌灵魂
{{include: shared/brand-soul}}

# 当前用户
- 部门：{{user.dept}}
- 岗位：{{user.role}}
- 区域：{{user.region}}

# 你的职责
1. 理解用户请求，决定调用哪个 SubAgent
2. 复杂多步任务先 write_todos 拆解，再分发
3. 默认按 user.dept 路由；用户明确说"以 X 部门视角"则切换
4. **任务类型 / 平台 / 受众 / 场景任一含糊 → 主动追问，不要乱猜**

# 路由规则
（同 §4.2）

# 长期记忆
- 用 manage_memory(key, value) 记录用户偏好/历史
- 用 search_memory(query) 检索过往
- namespace 系统自动绑定 user_id

# 红线
{{include: shared/safety-redlines}}
```

### 6.3 SubAgent Prompt 范例（marketing.md）

```markdown
你是 {{company_name}} 的营销 SubAgent。

# 公司 / 品牌灵魂
{{include: shared/company-essence}}
{{include: shared/brand-soul}}

# 当前用户
- 区域：{{user.region}}（决定文案语言/平台优先级）
- 岗位：{{user.role}}

# 工作原则
1. 先确认场景（什么内容、什么平台、什么目标），不确定就追问
2. 按需加载 skill：
   - 写文案 → copywriting-cn 或 copywriting-overseas（按 region）
   - 涉及 Logo/视觉 → vi-guidelines
   - 涉及具体产品 → product-handbook
   - 成稿前 → compliance-redlines 自检
3. 多步任务用 write_todos 推进
4. 输出永远符合品牌灵魂

# 红线
{{include: shared/safety-redlines}}
```

### 6.4 shared/ 内容（占位，由项目负责人后续填入）

```markdown
# shared/company-essence.md（待填）
[公司一句话定位] 例如："{{company_name}} 是一家专注于 ___ 的 ___ 公司"
[使命] 例如："让 ___ 更 ___"
[核心价值观] 不超过 3 条
```

```markdown
# shared/brand-soul.md（待填）
[品牌一句话灵魂] 例如："理性、克制、未来感"
[3 个调性形容词]
[绝对不要] 例如："不蹭热点低俗 / 不夸大 / 不堆砌形容词"
```

```markdown
# shared/safety-redlines.md（建议初版）
- 不主动透露薪酬、定价、未公开客户名单、未公开战略
- 法律 / 医疗 / 财务专业问题 → 建议用户咨询专业人士
- 越权请求（非 HR 索要员工档案、非 toB 索要客户报价）→ 拒绝并说明原因
- 输出引用具体数据时必须基于 skill 加载内容，不臆造
```

### 6.5 user_profile 注入

```python
# 后端伪代码
profile = supabase.table("profiles").select("*").eq("user_id", user_id).single()
prompt = render(template, user={
    "dept": profile.dept,
    "role": profile.role,
    "region": profile.region,
})
```

**`profiles` 表结构：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | uuid (FK auth.users) | 主键 |
| `dept` | text | marketing / hr / tob / content |
| `role` | text | 自由填写岗位（"营销经理"等） |
| `region` | text | overseas / cn / null |
| `display_name` | text | 显示名 |

**Onboarding**：通过 Supabase Studio 后台手动录入员工账号与 profile。

---

## 7. 模型选型

| 项目 | 配置 |
|---|---|
| **主力模型** | `deepseek-v4-flash`（284B / 13B 激活，1M 上下文） |
| **升级路径** | 复杂任务可 escalate 到 `deepseek-v4-pro`（1.6T / 49B 激活）。MVP 阶段保留接口、不开启自动 escalation；运营手动标记 |
| **配置方式** | LangChain `init_chat_model("deepseek-v4-flash", ...)`，`.env` 控制 |
| **Provider** | DeepSeek 官方 API（OpenAI-compatible）via `langchain-deepseek` 包 |
| **Prompt Cache** | DeepSeek 自动启用；按 §6.1 顺序最大化命中率 |
| **出网域名** | `api.deepseek.com` |

**定价（参考 2026-05）：**

| 模型 | Input (cache miss) | Input (cache hit) | Output |
|---|---|---|---|
| v4-flash | $0.14 / 1M | $0.0028 / 1M | $0.28 / 1M |
| v4-pro（promo 至 2026-05-31） | $0.435 / 1M | $0.003625 / 1M | $0.87 / 1M |
| v4-pro（list 价） | $1.74 / 1M | — | $3.48 / 1M |

---

## 8. 数据流：典型场景

### 8.1 场景 A：营销大陆员工写小红书种草文（理想路径）

```
1. 登录：前端 → Supabase Auth → 拿 JWT
2. 前端 → POST /threads/{id}/runs（带 JWT）
3. LangGraph @auth.authenticate：JWT → user_id → 查 profiles → 注入 state
4. Supervisor 节点：
   - 读 supervisor.md + shared/* + user_profile
   - 任务清晰 → 路由 marketing-agent
   - search_memory("学生党营销偏好") → 拿历史
5. marketing-agent 节点：
   - 加载 copywriting-cn SKILL.md 全文
   - 按 SKILL.md 指引读 platforms/xiaohongshu.md
   - 读 product-handbook 对应产品章节
   - 草稿 → 加载 compliance-redlines 自检
   - 出最终稿
6. Supervisor 收稿：manage_memory 写入用户偏好
7. SSE 流式返回前端
8. LangSmith trace 全程留痕
```

**单次会话 token 估算（Flash）：** ~6K input / ~500 output。其中 ~3-4K 为稳定 prefix（命中缓存几乎免费），实际成本约 ¥0.001 / 次。

### 8.2 场景 B：模糊任务（追问路径）

```
用户（HR 岗）："帮我写个东西"
→ Supervisor 检测：任务/平台/目标全含糊 → 触发追问
→ "你想写什么类型？例如：内部公告 / 招聘话术 / 培训材料 / 其他？"
→ 用户："给候选人发的 offer 通知"
→ Supervisor 路由 hr-agent
→ hr-agent 加载 recruiting/SKILL.md → 出稿
```

### 8.3 场景 C：失败 / 降级路径

| 异常 | 处理 |
|---|---|
| Supabase JWT 过期 | LangGraph @auth 401，前端拉起重登录 |
| profiles 表查不到 user | 通用兜底 prompt（无 dept/region），提示去 Supabase Studio 补录 |
| LangGraph Server 超时 | 前端 SSE 断流提示重试，Checkpointer 保留状态 |
| LLM 选错 skill | LangSmith trace 复盘 → 优化 SKILL.md description |
| Skill 文件不存在但 manifest 中声明 | 启动时校验，fail-fast 阻断部署 |
| Store 写入失败 | 记忆功能降级，不影响主对话；错误进 LangSmith |
| DeepSeek API 限流 / 中断 | 重试 3 次，仍失败则前端报错并建议稍后重试 |

---

## 9. 测试策略

| 层级 | 工具 | 关注点 |
|---|---|---|
| 单元 | pytest | auth handler、prompt 模板渲染、profile 注入 |
| 集成 | `langgraph dev` + httpx | 4 部门各 1 条主路径能跑通 |
| Skill 召回准确率 | **LangSmith dataset + LLM-as-judge** | 每部门 20 个典型问题 → 是否选对 skill。**最关键的回归集** |
| Prompt 输出质量 | LangSmith eval（人工 + LLM 双审） | 是否符合品牌调性、是否触发追问 |
| 用户验收 | 5–10 人内测（营销 + HR） | "答错/答漏/调性不对"案例库 |

---

## 10. 交付节奏（7–10 周，独立开发）

```
阶段 0  准备                  ─  1 周
        Supabase Self-Hosted Docker / LangSmith 项目 / git 仓库 / WSL2

阶段 1  骨架打通              ─  1 周
        Supervisor + 1 空 SubAgent
        Supabase auth ↔ LangGraph @auth
        Agent Chat UI 登录 → 发消息 → 回复 → trace 可见

阶段 2  多 SubAgent + Skill   ─  2 周
        4 SubAgent 全上、SkillsMiddleware 接好
        12–20 个 skill 的 MVP 版 SKILL.md（每页一份，无子文件）
        profiles 表 + user_profile 注入

阶段 3  Prompt 体系 + 长期记忆 ─  1 周
        shared/ 内容由负责人填入 git
        路由 / 追问机制调优
        Store + manage_memory/search_memory（仅 Supervisor）

阶段 4  内测 + 调优            ─  1–2 周
        LangSmith eval dataset：营销 + HR 各 20 个典型问题
        5–10 人内测（营销 + HR 优先）→ 反馈 → 改 description / prompt

阶段 5  上线 + 培训            ─  1 周
        全员可用
        培训运营接口人提 skill PR
        建立 LangSmith 周复盘机制
```

---

## 11. 上线前 must-have checklist

- [ ] Supabase RLS 开启在 `profiles` / `store` / `checkpoints`
- [ ] LangSmith 区分 `dev` / `prod` project
- [ ] 前端打包不暴露 LangSmith / Supabase service_role key
- [ ] `shared/*` 三个 prompt 文件填完且 review 过
- [ ] 至少营销 + HR 各 3 个完整 skill（含子文件，非纯占位）
- [ ] LangSmith 内测 dataset 通过率 ≥ 80%
- [ ] WSL2 + Docker Desktop 部署电脑稳定运行 ≥ 7 天
- [ ] Supabase Self-Hosted 备份策略到位（pg_dump cron）

---

## 12. 留待后续阶段的问题

- shared/ prompt 三个文件的实际内容（项目负责人填）
- 各 skill 的具体内容（运营整理 → 负责人 review → 进 git）
- 应用层权限过滤（按用量再加；当前用 prompt 限定）
- 单 skill 内嵌 RAG（视 SKILL.md 长度爆炸再加）
- Audit 日志（先靠 LangSmith trace；正式合规要求出现时再实现）
- HTTPS / 公网访问（远程办公场景再加）
- DeepSeek-V4-Pro 自动 escalation 策略
- 多语言 UI（当前中文优先）
- 移动端适配

---

## 13. 关键技术栈版本（拟定）

| 组件 | 版本 |
|---|---|
| Python | 3.11+ |
| langchain | ≥ 1.0 |
| langgraph | 最新稳定版 |
| deepagents | 最新稳定版 |
| langchain-deepseek | 最新稳定版 |
| Next.js | 14（Agent Chat UI 默认） |
| Supabase Self-Hosted | docker-compose 官方版 |
| Docker Desktop | 最新（Windows 11） |
| WSL2 | Ubuntu 22.04 |

具体版本号在实施计划阶段锁定。

---

## 附录 A：术语表

| 术语 | 含义 |
|---|---|
| Supervisor | LangGraph 中的主路由 agent，决定 SubAgent 调度 |
| SubAgent | 部门级专用 agent，每个绑定一组 skill |
| Skill | Anthropic Agent Skills 标准的目录单元，含 `SKILL.md` + 子文件，按需加载 |
| Progressive Disclosure | Skill 三级渐进披露：discovery → activation → execution |
| Checkpointer | LangGraph 的会话级状态持久化（短期记忆） |
| Store | LangGraph 的跨会话持久化（长期记忆，per-user namespace） |
| profiles | Supabase 中的员工属性表（dept / role / region） |
