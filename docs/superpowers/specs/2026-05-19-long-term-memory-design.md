# 长期记忆设计（按账号隔离 + 人工审核）

**日期：** 2026-05-19
**状态：** 设计阶段 —— 你审核通过后才进入实施计划
**参考：** [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) —— 冻结快照式纯文本记忆模式

---

## 目标

让每个登录账号有一份**独立、有边界、跨会话不丢**的记忆。每次新建对话时 AI 自动加载这份记忆；什么能进记忆**由用户控制**：点"总结"按钮 → AI 提候选 → 你勾选/修改 → 入库。

做完之后的实际体验：

- 账号 A 在 thread T1 说："我叫小明，HR 部门，喜欢简洁回答"。
- 几天后账号 A 开 thread T2 问："你还记得我是哪个部门的吗"，AI 答得上来，不用再说一遍。
- 账号 B 登录 —— 完全看不到账号 A 的任何记忆。

## 非目标（MVP **不做**的事）

下面这些是故意推迟的。每一项都会多一层复杂度，等有具体需求再做。

- **语义搜索 / embedding** —— 字符上限够小，纯文本直接塞进系统提示就行，不需要检索。
- **跨会话全文搜索过往对话**（Hermes 有；本期不做）。
- **AI 自主决定要不要记**（Hermes 是全自动的；我们要的是手动 + HITL）。
- **独立的记忆管理 UI**（浏览 / 编辑现有记忆）—— 暂时只通过"总结"按钮入口。
- **记忆过期 / 老化** —— 条目一直留着，直到 AI 因字符超限自己合并/丢弃。

## 整体架构

```
┌──────────────────────┐                ┌──────────────────────┐
│ 前端 (Next.js)        │                │  LangGraph 后端       │
│                      │                │                      │
│  [ 输入框 ] [💾按钮 ]  │ ──总结指令───▶  │  Supervisor           │
│                      │                │   ↓ 进入总结模式        │
│  候选审核面板          │ ◀── interrupt ─│   interrupt(候选列表)   │
│  ☑ 可编辑文本  ☐  ☑   │                │                      │
│  [确认] [取消]        │ ─── resume ───▶│  循环: memory.add()    │
│                      │                │   ↓                  │
└──────────────────────┘                │  Postgres Store      │
                                        │  ns=(user_id, 桶名)   │
                                        └──────────────────────┘
                                                ▲
                                                │ 每个新 thread
                                                │ 启动时加载，
                                                │ 注入系统提示
                                                ▼
                                        ┌──────────────────────┐
                                        │ Supervisor + 所有     │
                                        │ SubAgent 在会话开始    │
                                        │ 都能看到记忆          │
                                        └──────────────────────┘
```

## 存储模型

**后端**：复用现有的 `AsyncPostgresStore`（`docker-compose.yml` 里的 `LANGGRAPH_STORE` 已经接好）。表首次使用时自动建；`init_db.py` 兜底冷启动。

**每用户两个命名空间：**

```
(user_id, "memory")   —— AI 笔记：环境事实、项目约定、历史发生过的事
(user_id, "user")     —— 用户画像：身份、偏好、沟通风格
```

`user_id` 取自 `backend/src/auth.py` 里设置的 `ctx.user.identity`（Supabase JWT 的 `sub`）。**工具内部强制锁定当前用户的命名空间**，AI 不能通过传假 user_id 跨账号读写 —— 隔离是在工具层做的，不是在 AI 层。

**条目格式**：纯文本，多行 OK，磁盘里用 `\n§\n` 分隔。Store 的 key 用自动生成的 UUID。

```json
{
  "namespace": ["user-uuid-here", "user"],
  "key": "01HA...",
  "value": {
    "content": "用户名小明，HR 部门，偏好简洁回答",
    "created_at": "2026-05-19T08:42:00Z"
  }
}
```

**字符上限（直接抄 Hermes，实战验证过的）：**

| 桶名 | 字符上限 | 大约 token |
|---|---|---|
| `memory` | 2,200 | ~800 |
| `user` | 1,375 | ~500 |

**桶满了怎么办**：AI 调 `memory.add` 时工具返回错误 "桶已满，先合并或删除旧条目"。AI 收到后自己用 `replace`/`remove` 腾空间，再重试 add。

## 记忆工具

一个 `memory` 工具，三个动作 —— 跟 Hermes 一模一样：

```python
memory(action="add",     target="user"|"memory", content="...")
memory(action="replace", target="user"|"memory", old_text="<子串>", content="...")
memory(action="remove",  target="user"|"memory", old_text="<子串>")
```

- `old_text` 是**一段唯一短子串**就行 —— 不用 ID、不用全文匹配。如果子串匹配到 0 条或多条，工具报错让 AI 给更具体的子串。这样比传全文省 token。
- 工具只能看见当前用户的命名空间，做不到跨用户读写。
- `add` / `replace` 写入前必须过**安全扫描**（下面详述）。被拦下来的内容工具调用直接失败并返回拒绝原因。

**用户永远不直接调这个工具** —— 它是内部工具，只在 HITL 确认阶段和 AI 自己整理桶时用。

## 系统提示注入

**每个新 thread 开始时**（= 每开一个新对话）：

1. 从 Store 读出 `(user_id, "memory")` 和 `(user_id, "user")` 的所有条目。
2. 按 Hermes 风格渲染两个块：

```
══════════════════════════════════════════════
USER PROFILE [42% — 578/1,375 chars]
══════════════════════════════════════════════
用户名小明，HR 部门
§
偏好简洁回答
```

3. 两块都拼到 supervisor 的系统提示词最前面，**一次性注入**，对话开始。

**冻结快照规则（性能关键）**：系统提示在 thread 开始时拍下来就**不变了**，哪怕 HITL 确认过程中 `memory.add` 写了新条目也不变。新条目会立刻写进 Postgres（持久化没问题），但要等**下一个 thread** 才会出现在系统提示里。这样保住 LLM 的 prefix 缓存，整个 thread 都吃缓存命中。

**DeepAgents 怎么接这个钩子**：
- 用一个 **prompt-builder 中间件**（或者别的钩子），每个 thread 启动时跑一次：读 Store → 渲染两个块 → 拼到 `supervisor.md` 内容前面。
- SubAgent 通过自己的系统提示继承到记忆块（不需要每个 SubAgent 单独再读一次）。

## HITL 总结流程（端到端）

1. **触发** —— 用户点输入框旁边的 💾 按钮。前端发一个特殊控制消息：
   ```json
   { "command": "summarize_memory", "thread_id": "<当前 thread>" }
   ```
2. **后端总结** —— Supervisor 收到这个控制消息，切到**总结模式**：
   - 读当前 thread 的对话历史
   - 读已存在的记忆（避免重复提候选）
   - 输出结构化 JSON：
     ```json
     {
       "candidates": [
         { "target": "user",   "content": "..." },
         { "target": "memory", "content": "..." }
       ]
     }
     ```
3. **中断（Interrupt）** —— Supervisor 调 LangGraph 的 `interrupt({ "kind": "memory_candidates", "candidates": [...] })`。图执行暂停，控制权回前端。
4. **前端面板** —— 聊天 UI 渲染一个中断气泡：
   ```
   ┌─ MEMORY CANDIDATES（记忆候选） ──────────┐
   │ ☑ [USER]   用户名小明，HR 部门              │  ← 文本可编辑
   │ ☑ [MEMORY] 偏好简洁回答                     │  ← 文本可编辑
   │ ☐ [MEMORY] 提到过项目 X                     │  ← 没勾，跳过
   │                                            │
   │           [ 确认 ]  [ 取消 ]                │
   └────────────────────────────────────────────┘
   ```
   现有 `agent-chat-ui` 自带 `agent-inbox-interrupt` 渲染机制 —— 不用从零写，加一个新的 interrupt `kind` 就行。
5. **恢复（Resume）** —— 用户点"确认"。前端发 `Command(resume={accepted: [...编辑后的内容...]})`。Supervisor 循环逐条调 `memory(action="add", ...)`。点"取消" → 发 `accepted: []`，啥也不存。
6. **回执** —— Supervisor 发一条简短消息："已记住 3 条"。对话继续正常进行。

## 安全：内容扫描

每次 `add`/`replace` 写入前都过 `_scan_memory_content(content)`。直接抄 Hermes 的正则，这些是会被注入系统提示的内容，威胁面要小心：

- **Prompt 注入**："忽略上述指令"、"你现在是…"、"无视所有规则"、角色劫持。
- **欺骗用户**："不要告诉用户…"。
- **密钥外泄**：shell 命令里抓 `$API_KEY`、`$TOKEN`、读 `.env` `.netrc`。
- **后门留存**：`authorized_keys`、`~/.ssh` 之类的引用。
- **不可见 unicode**：零宽字符、RTL/LTR 翻转字符。

被拦下的内容工具返回失败 + 拒绝原因；AI 把原因告诉用户。HITL 阶段用户能编辑后重试。

## 代码文件布局

```
backend/src/
├── memory/
│   ├── __init__.py
│   ├── store.py          # 对 AsyncPostgresStore 的薄封装：按命名空间读写
│   ├── tool.py           # memory 工具本体（add/replace/remove + 子串匹配）
│   ├── security.py       # 抄 Hermes 的 _scan_memory_content
│   ├── prompt_inject.py  # 根据 user_id 渲染两个记忆块
│   └── summarize.py      # 总结模式的提示词 + JSON 候选解析
└── agent.py              # 在 create_deep_agent 里接入工具 + prompt-inject 钩子

frontend/agent-chat-ui/src/
├── components/thread/
│   ├── memory-summarize-button.tsx     # 输入框旁边的 💾 按钮
│   └── memory-candidates-interrupt.tsx # HITL 审核面板
└── lib/
    └── memory.ts                       # 类型定义 + 扩展 agent-inbox-interrupt 联合类型
```

## 待解决的问题 / 风险点

1. **DeepAgents 的 prompt 注入钩子** —— `create_deep_agent` 接受 `system_prompt` 是个静态字符串。我们需要 (a) 跑在 graph 前的中间件动态改提示，或者 (b) 在 auth / init 钩子里算好再传进去。**进实施计划前先做个 small spike 验证一下哪条路通**。
2. **`init_db.py` 第一次部署时跑** —— 现在是手动一次性脚本。可能要做成容器启动时自动跑一次（幂等的），免得部署者忘了。这块跟记忆功能本身无关，但提一下避免踩坑。
3. **总结质量靠提示词** —— 会单写一份 `prompts/summarize_memory.md`，明确要求：只抽取持久性事实、跳过临时细节、最多 5 个候选。
4. **Thread 开始时的 token 预算** —— 2,200 + 1,375 = 3,575 字符最多加到系统提示里。够用而且不夸张，但 prompt 缓存成本评估时记得这部分。

## 验收标准

- **隔离测试通过**：账号 A 写的记忆永远不出现在账号 B 的命名空间查询里（集成测试覆盖）。
- **HITL 面板能用**：可以取消勾选、可以改文本、点确认后只有勾上的 + 编辑后的内容入 Store。
- **新 thread 能看到记忆**：开新对话，记忆块出现在系统提示里，AI 能回答需要"之前记忆"才能答对的问题。
- **超限保护生效**：桶满时 AI 能收到明确错误，调 `replace`/`remove` 整理后重试成功。
