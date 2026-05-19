# 长期记忆设计（按账号隔离）

**日期：** 2026-05-19
**状态：** ✅ 已实现并合入 `main`（详见 `docs/superpowers/plans/2026-05-19-long-term-memory.md` 的实施记录）
**参考：** [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) —— 冻结快照式纯文本记忆模式

> **实现期的设计调整**（与原始设计的差异）：
> - **手动总结按钮的 HITL 候选审核面板取消了**，改为"点一下 → AI 静默循环 `memory.add` → 回'已记住 N 条'"。Toast 撤销机制保留，给反悔的口子。
> - **系统提示注入**从原计划的 `abefore_agent` 改成 `awrap_model_call`，记忆只塞进给 LLM 的 `system_message`，**不进 `state.messages`**。这样既不会前端误渲染、也不会每轮 append 一次累加。

---

## 目标

让每个登录账号有一份**独立、有边界、跨会话不丢**的记忆。每次新建对话时 AI 自动加载这份记忆；什么能进记忆，**两个入口都开**：

- **AI 自主入库**：聊天过程中 AI 自己判断"这是值得长期记住的事"就静默存进去，前端冒一个 Toast 通知 + 5 秒"撤销"按钮。
- **手动总结按钮**：点输入框旁边的 💾，AI 扫一遍当前对话循环调用 `memory.add` 把值得记的事都存进去，回一句"已记住 N 条"。每条同样会触发 Toast（带撤销）。

做完之后的实际体验：

- 账号 A 在 thread T1 说："我叫小明，HR 部门，喜欢简洁回答"。
- 几天后账号 A 开 thread T2 问："你还记得我是哪个部门的吗"，AI 答得上来，不用再说一遍。
- 账号 B 登录 —— 完全看不到账号 A 的任何记忆。

## 非目标（MVP **不做**的事）

下面这些是故意推迟的。每一项都会多一层复杂度，等有具体需求再做。

- **语义搜索 / embedding** —— 字符上限够小，纯文本直接塞进系统提示就行，不需要检索。
- **跨会话全文搜索过往对话**（Hermes 有；本期不做）。
- **独立的记忆管理 UI**（浏览 / 编辑现有记忆）—— 暂时只通过"总结"按钮 + Toast 撤销入口。
- **记忆过期 / 老化** —— 条目一直留着，直到 AI 因字符超限自己合并/丢弃。

## 整体架构

**两条入库路径并存**：

```
路径 ①  AI 自主入库（实时、静默 + Toast）
─────────────────────────────────────────
[ 聊天中 AI 听到 "我叫小明" ]
        ↓
[ Supervisor 自主调 memory.add ]                ┌──────────────┐
        ↓                                       │ Postgres     │
[ 工具写 Postgres Store ] ────────────────────▶ │ Store        │
        ↓                                       │ (user_id, 桶)│
[ 后端 emit 流式事件 memory_saved ]              └──────────────┘
        ↓
[ 前端 Toast: "已记住：用户叫小明 [撤销]" ]
        ↓（用户 5 秒内点撤销）
[ 前端调 memory.remove ]


路径 ②  手动总结按钮（一体化 / 静默批量）
─────────────────────────────────────────
[ 输入框旁 💾 按钮 ]
        ↓ submit 隐藏 human message "__summarize_memory__"
[ Supervisor 识别触发词，进总结模式 ]
        ↓ 扫一遍当前 thread 对话
[ 循环 memory.add(...) N 条 ]  ──每条都触发 memory_saved 流式事件
        ↓                       ↓ 每条单独冒 Toast（含撤销）
[ 回复 "已记住 N 条。" ]


路径 ③  每次 LLM 调用都临时拼记忆（消费）
─────────────────────────────────────────
[ 任意一次 model call ]
        ↓ awrap_model_call 钩子拦截
[ 从 runtime.store 读当前 user 的两个桶 ]
        ↓
[ 拼到 ModelRequest.system_message ]
        ↓
[ 给 LLM 发请求 → 回应 → state.messages 不变 ]
        ↓
[ 前端永远看不到记忆块；冻结快照由钩子幂等保证 ]
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

### 工具描述（这部分**就是引导 AI 自主存的关键**）

Hermes 的设计精髓：让 AI **自主决定什么时候存**，引导写在**工具描述里**而不是系统提示里 —— 这样每次 AI 看见工具就重新加载这套判断标准。直接抄过来并本地化：

```
保存能跨会话存活的关键信息到长期记忆。记忆会注入未来会话的系统提示，
所以保持精简，只存日后还有用的事实。

主动存（不要等用户开口）：
- 用户纠正你，或者说"记住这个"/"别再这样了"
- 用户分享偏好、习惯或个人信息（姓名、角色、时区、沟通风格）
- 你发现关于环境的事（部门、岗位、所属团队、项目结构）
- 你学到这个用户特有的约定、API 怪癖或工作流
- 你识别出一个稳定事实，未来某次会话还用得上

优先级：用户偏好和纠正 > 环境事实 > 流程性知识。
最值钱的记忆是**让用户不用重复说同一件事**。

不要存：任务进度、会话产出、完成日志、临时 TODO 状态 —— 这些下次靠
对话历史就行；本期没做跨会话搜索，等做了再说。

两个目标：
- 'user'  ：用户身份/偏好/沟通风格/雷区
- 'memory'：你自己的笔记/环境事实/项目约定/教训

动作：
- add     ：新增一条
- replace ：更新现有条（old_text 用一段短唯一子串定位）
- remove  ：删除一条（同上）

跳过：无关紧要的、容易重新发现的、原始数据 dump、临时任务状态。
```

**用户永远不直接调这个工具** —— 它是内部工具，给 AI 自己用。

### 入库路径

| 触发 | 路径 | UI 反馈 |
|---|---|---|
| AI 聊天中自主判断"这事值得记" | 直接调 `memory.add` | 流式事件 → 前端 Toast `已记住：xxx [撤销]`（停留 5s） |
| 用户点 💾 总结按钮 | 隐藏 human message `__summarize_memory__` → Supervisor 循环 `memory.add` | 每条单独冒 Toast；AI 最后回 `已记住 N 条。` |
| AI 主动调用整理（桶满了） | `memory.replace / remove` | 同 Toast，但内容是"已合并：xxx [撤销]" |

### Toast 撤销机制

后端 `memory.add` 工具成功返回后，触发一个流式事件（LangGraph `astream_events` 的 custom event）：

```json
{
  "kind": "memory_saved",
  "key": "01HA...",
  "target": "memory",
  "content": "用户叫小明"
}
```

前端监听这个事件，用现有的 `sonner` toast 组件渲染。Toast 上有一个"撤销"按钮，5 秒倒计时；点了就发一条隐藏 human message `__undo_memory__:<target>:<key>`，Supervisor 识别后调 `memory_undo(target, key)` 精确删除（不走子串匹配）。

5 秒过了或用户点别处，toast 自然消失，记忆就**正式落实**了。这个时间窗给用户"AI 存错了立刻反悔"的机会，不打断聊天主流程。

## 系统提示注入

**每次 LLM 调用前**（= `awrap_model_call` 钩子）：

1. 从 `runtime.store` 读当前 user 的 `(user_id, "memory")` 和 `(user_id, "user")` 两个命名空间的所有条目。
2. 按 Hermes 风格渲染两个块：

```
══════════════════════════════════════════════
USER PROFILE [42% — 578/1,375 chars]
══════════════════════════════════════════════
用户名小明，HR 部门
§
偏好简洁回答
```

3. 把渲染结果**追加到 `ModelRequest.system_message.content`**（不写 state.messages）后再调 `handler(request)` 给 LLM。

**为什么用 `awrap_model_call` 不用 `before_agent`**（实现过程踩过的坑）：
- 用 `before_agent` 返回 `{"messages": [SystemMessage(memory_block)]}` 会把记忆**写进 `state.messages` 的 add_messages reducer**，结果是：(a) 前端聊天界面会**渲染出**记忆块、(b) 每一轮 user 消息都会触发新的 agent run，每次都 append 一遍，几轮之后系统提示里堆好几份重复的记忆。
- `awrap_model_call` 只修改本次请求的 `system_message`，**不进 state**。前端永远看不见、不会累加。每次 LLM 调用都临时拼一次（开销可忽略，Store 读取是命名空间内的 SELECT）。

**SubAgent 怎么继承**：DeepAgents 把 supervisor 调度出去的 SubAgent 也会经过同样的 middleware（因为 `create_deep_agent(middleware=[...])` 是图级注册），所以每个 SubAgent 的 LLM 调用同样会看到记忆块。

## 手动总结流程（端到端，**静默版**）

1. **触发** —— 用户点输入框旁边的 💾 按钮（`MemorySummarizeButton`）。前端调 `stream.submit({messages: [{type:"human", content:"__summarize_memory__"}]})`，把这条隐藏 human message 加进 thread。
2. **Supervisor 识别** —— `supervisor.md` 里的 `<memory>` 块明确写了这种格式触发总结模式：
   - 扫一遍当前 thread 的对话历史
   - 按 `memory` 工具的 "WHEN TO SAVE" 准则识别值得长期记住的事实，**最多 5 条**
   - 跳过已经在系统提示的 USER PROFILE / MEMORY 块里出现过的（避免重复）
3. **循环写入** —— 对每条事实调 `memory(action="add", target="user"|"memory", content="...")`。每次成功都触发 `memory_saved` 流式事件 → 前端冒 Toast。
4. **结束回复** —— Supervisor 发一句 `已记住 N 条。`（或 `没有需要记忆的新内容。`）。无 HITL 审核面板、无 interrupt、无 JSON 候选解析。
5. **反悔通道** —— 用户对任何一条不满意，在 Toast 的 5 秒窗口内点撤销即可。

## 安全：内容扫描

每次 `add`/`replace` 写入前都过 `_scan_memory_content(content)`。直接抄 Hermes 的正则，这些是会被注入系统提示的内容，威胁面要小心：

- **Prompt 注入**："忽略上述指令"、"你现在是…"、"无视所有规则"、角色劫持。
- **欺骗用户**："不要告诉用户…"。
- **密钥外泄**：shell 命令里抓 `$API_KEY`、`$TOKEN`、读 `.env` `.netrc`。
- **后门留存**：`authorized_keys`、`~/.ssh` 之类的引用。
- **不可见 unicode**：零宽字符、RTL/LTR 翻转字符。

被拦下的内容工具返回失败 + 拒绝原因；AI 把原因告诉用户，并按需重试（去掉敏感片段）。

## 代码文件布局（实际实现）

```
backend/src/
├── memory/
│   ├── __init__.py
│   ├── store.py          # 对 AsyncPostgresStore 的薄封装：按命名空间读写
│   ├── tool.py           # memory 工具 + memory_undo 工具（key 精确删）
│   ├── security.py       # 抄 Hermes 的 _scan_memory_content
│   └── prompt_inject.py  # MemoryInjectMiddleware（awrap_model_call 钩子）+ render_memory_blocks
└── agent.py              # 在 create_deep_agent 里接入工具 + middleware

backend/tests/
├── test_memory_store.py        # 4 个隔离测试
├── test_memory_security.py     # 6 个威胁模式测试
├── test_memory_tool.py         # 4 个工具行为测试
├── test_memory_inject.py       # 5 个渲染 / 隔离测试
└── test_memory_integration.py  # 3 个跨用户隔离 / 并发测试

frontend/agent-chat-ui/src/
├── components/thread/
│   ├── memory-summarize-button.tsx  # 输入框旁的 💾 按钮（发 __summarize_memory__）
│   └── memory-toast.tsx              # AI 自主入库时的 Toast + 撤销（sonner）
├── providers/Stream.tsx              # onCustomEvent 监听 memory_saved + 撤销 submitRef
└── lib/memory.ts                     # MemorySavedEvent 类型 + isMemorySavedEvent 类型守卫

prompts/
└── supervisor.md                     # <memory> 块定义工具用法 + 两条隐藏指令识别
                                      #   __undo_memory__:<target>:<key>
                                      #   __summarize_memory__
```

> **HITL 候选审核面板 (`memory-candidates-interrupt.tsx`) 和总结 JSON 解析器 (`summarize.py`) 没建** —— 设计调整为静默总结后这两个文件用不上了。

## 实现过程中遇到 / 解决的问题（保留作为后人参考）

1. **DeepAgents 的 prompt 注入钩子** ✅ 解决 —— `create_deep_agent` 支持 `middleware=` 参数。继承 `langchain.agents.middleware.types.AgentMiddleware` 实现 `awrap_model_call`，参数 `request: ModelRequest` 有 `system_message` 字段可改。
2. **`init_db.py` 第一次部署** ✅ 解决 —— Dockerfile.langgraph 的 `CMD` 里已经会自动跑一次。
3. **总结质量靠提示词** ✅ 解决 —— 没单独写文件，直接把规则塞进 `supervisor.md` 的 `<memory>` 块 `__summarize_memory__` 段（最多 5 条 / ≤200 字符 / 跳过已有 / 跳过临时任务）。
4. **Thread 开始时的 token 预算** ✅ 已知 —— 上限是 2,200 + 1,375 = 3,575 字符，每次 LLM 调用都会拼一次。Prompt 缓存方面 DeepSeek 自动处理。
5. **Toast 撤销的传输机制** ✅ 解决 —— 选 (a) 方案：新增 `memory_undo` 工具按 `key` 精确删，前端发隐藏 human message `__undo_memory__:<target>:<key>` 触发，supervisor.md 识别后调用。
6. **AI 一次性存太多导致 Toast 堆叠** ⚠️ 未来再说 —— 现在没设上限，`sonner` 自动堆叠。实测 5 条以内体验 OK。如果用户反馈 toast 太多，再考虑合并显示。
7. **`runtime.context` 不带 user_id** ✅ 解决 —— LangGraph Platform 把 `auth.py` 返回的 `{"identity": user_id, ...}` 包成 ProxyUser 后挂在 `runtime.server_info.user.identity`（不是 `runtime.context`）。
8. **`docker exec ... pytest` 看不到代码改动** ✅ 解决 —— `docker-compose.yml` 给 langgraph 容器加了 `../backend/src:/app/backend/src` 和 `../backend/tests:/app/backend/tests` 的 bind mount，host 改文件容器立即生效。

## 验收标准

- **隔离测试通过**：账号 A 写的记忆永远不出现在账号 B 的命名空间查询里（集成测试覆盖）。
- **自主入库 + Toast 能用**：聊天中说"我叫小明，HR 部门"，AI 自己存了，下方冒 Toast 显示"已记住：xxx [撤销]"，5 秒内点撤销能把它从 Store 删掉，5 秒后没动就保留。
- **HITL 面板能用**：点 💾 按钮 → 候选面板出现 → 可以取消勾选、可以改文本、点确认后只有勾上的 + 编辑后的内容入 Store。
- **新 thread 能看到记忆**：开新对话，记忆块出现在系统提示里，AI 能回答需要"之前记忆"才能答对的问题。
- **超限保护生效**：桶满时 AI 能收到明确错误，调 `replace`/`remove` 整理后重试成功。
