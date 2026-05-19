# Long-term memory (per-user, HITL-curated)

**Date:** 2026-05-19
**Status:** Design — awaiting approval before implementation plan
**Inspired by:** [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — frozen-snapshot text memory pattern

---

## Goal

Give each logged-in user a **bounded, persistent memory** that survives across conversations. The agent recalls memory automatically at the start of every new thread; the user controls what enters memory through a **manual "summarize" button** plus **HITL approval**.

After this ships:

- Account A says "我叫小明，HR 部门，喜欢简洁回答" in thread T1.
- Days later in thread T2, account A asks "你还记得我是哪个部门的吗" — agent answers correctly without account A re-telling it.
- Account B sees zero of account A's memory.

## Non-goals (MVP)

These are deliberately deferred. Each adds a layer that we'll only build when a concrete need shows up.

- Semantic search / embeddings — char-limited plain text fits in the system prompt without retrieval.
- Cross-session FTS search of past conversations (Hermes does this; out of scope here).
- Autonomous memory writes by the agent (Hermes does this; we want manual + HITL for MVP).
- Per-bucket UI for browsing/editing memory outside the summarize flow.
- Memory expiration / aging — entries stay until the agent consolidates them under char-limit pressure.

## Architecture

```
┌─────────────────────┐                ┌──────────────────────┐
│ Frontend (Next.js)  │                │  LangGraph backend   │
│                     │                │                      │
│  [ chat input ] [💾]│ ──summarize──▶ │  Supervisor          │
│                     │                │   ↓ runs summary     │
│  candidate panel    │ ◀──interrupt── │   interrupt(cands)   │
│  ☑ edit  ☐  ☑  …    │                │                      │
│  [confirm] [cancel] │ ──resume──────▶│  loop: memory.add()  │
│                     │                │   ↓                  │
└─────────────────────┘                │  Postgres Store      │
                                       │  ns=(user_id,bucket) │
                                       └──────────────────────┘
                                                ▲
                                                │ load on every
                                                │ new thread →
                                                │ inject system
                                                │ prompt
                                                ▼
                                       ┌──────────────────────┐
                                       │ Supervisor + all     │
                                       │ SubAgents see memory │
                                       │ at session start     │
                                       └──────────────────────┘
```

## Storage model

**Backend:** existing `AsyncPostgresStore` (already wired in `docker-compose.yml` via `LANGGRAPH_STORE`). Tables auto-created on first use; `init_db.py` covers cold-start case.

**Namespace per user:**

```
(user_id, "memory")   — agent's notes: env facts, project conventions, history
(user_id, "user")     — user profile: identity, preferences, communication style
```

`user_id` comes from `ctx.user.identity` set in `backend/src/auth.py` (Supabase JWT `sub` claim). Tools refuse to read/write any namespace except the current request's user. Isolation is enforced **inside the tool**, not at the agent layer — the agent cannot bypass it by passing a fake user_id.

**Entry format:** plain text, multiline OK, delimited by `\n§\n` on disk concatenation, generated UUID as the Store key.

```
{
  "namespace": ["user-uuid-here", "user"],
  "key": "01HA…",
  "value": {
    "content": "用户名小明，HR 部门，偏好简洁回答",
    "created_at": "2026-05-19T08:42:00Z"
  }
}
```

**Char limits (mirror Hermes, battle-tested):**

| Bucket | Limit (chars) | Approx tokens |
|---|---|---|
| `memory` | 2,200 | ~800 |
| `user` | 1,375 | ~500 |

When a bucket is full, the agent's `memory.add` call returns an error message: "Bucket full — consolidate or remove entries first." The agent then does `replace`/`remove` to free space before retrying.

## Memory tool

Single tool `memory` with `action` parameter — same shape Hermes uses:

```python
memory(action="add",     target="user"|"memory", content="...")
memory(action="replace", target="user"|"memory", old_text="<substring>", content="...")
memory(action="remove",  target="user"|"memory", old_text="<substring>")
```

- `old_text` is a **short unique substring** — no IDs, no full-text matching. If the substring matches 0 or >1 entries, the tool returns an error asking for a more specific match. This is much cheaper on tokens than passing full text.
- Tool only sees the current user's namespace; cannot read/write across users.
- Before any `add`/`replace`, content passes through the **security scanner** (see below). Blocked content fails the call with the reason.

The tool exists for the **HITL confirm phase** and any consolidation the agent does. The user **never types `/memory` themselves** — it's an internal tool.

## System prompt injection

At every **thread start** (= every new conversation):

1. Read all entries for `(user_id, "memory")` and `(user_id, "user")` from the Store.
2. Render two blocks in Hermes' format:

```
══════════════════════════════════════════════
USER PROFILE [42% — 578/1,375 chars]
══════════════════════════════════════════════
用户名小明，HR 部门
§
偏好简洁回答
```

3. Inject both blocks into the supervisor's system prompt **once**, before the conversation starts.

**Frozen-snapshot rule (critical for performance):** the system prompt is captured at thread start and **does not change mid-thread** even if `memory.add` writes new entries during HITL confirm. New entries land in Postgres immediately (durable), but appear in the system prompt only on the **next** thread. This preserves the LLM provider's prefix cache across the whole thread.

To make this work in DeepAgents:
- Use a **prompt builder hook** (or middleware) that runs once per thread, reads the Store, formats the blocks, and prepends them to the existing `supervisor.md` content.
- SubAgents inherit the supervisor's memory blocks via their own system prompts (no separate per-subagent fetch).

## HITL summarize flow

1. **Trigger** — user clicks 💾 button next to chat input (frontend). The frontend sends a special control message:
   ```json
   { "command": "summarize_memory", "thread_id": "<current>" }
   ```
2. **Backend summary** — supervisor receives the control message, switches to a dedicated **summary mode**:
   - Reads the current thread's messages
   - Reads existing memory (so it doesn't propose duplicates)
   - Outputs structured JSON:
     ```json
     {
       "candidates": [
         { "target": "user",   "content": "..." },
         { "target": "memory", "content": "..." }
       ]
     }
     ```
3. **Interrupt** — supervisor calls LangGraph's `interrupt({ "kind": "memory_candidates", "candidates": [...] })`. Execution pauses, control returns to frontend.
4. **Frontend panel** — chat UI renders an interrupt bubble:
   ```
   ┌─ MEMORY CANDIDATES ─────────────────────┐
   │ ☑ [USER]   用户名小明，HR 部门             │  ← editable text
   │ ☑ [MEMORY] 偏好简洁回答                    │  ← editable text
   │ ☐ [MEMORY] 提到过项目 X                    │  ← unchecked, will skip
   │                                            │
   │           [ CONFIRM ]  [ CANCEL ]          │
   └────────────────────────────────────────────┘
   ```
   Existing `agent-chat-ui` `agent-inbox-interrupt` infrastructure renders this — no new plumbing needed, just a new interrupt `kind`.
5. **Resume** — user clicks Confirm. Frontend sends `Command(resume={accepted: [...edited content...]})`. Supervisor loops through accepted candidates and calls `memory(action="add", ...)` for each. Cancel → resume with `accepted: []`, nothing persists.
6. **Acknowledge** — supervisor sends one short message: "已记住 3 条". Thread continues normally.

## Security: content scanning

Every `add`/`replace` runs `_scan_memory_content(content)` before writing. Copy Hermes' patterns verbatim — they cover the threats that matter for content that gets injected into the system prompt:

- **Prompt injection**: "ignore previous instructions", "you are now…", "disregard all rules", role hijacks.
- **Deception**: "do not tell the user…".
- **Exfiltration**: shell commands grabbing `$API_KEY`, `$TOKEN`, `.env`, `.netrc`.
- **Persistence backdoors**: references to `authorized_keys`, `~/.ssh`.
- **Invisible unicode**: zero-width chars, RTL/LTR overrides.

Blocked content fails the tool call with the reason; the agent surfaces it to the user. HITL gives the user a chance to edit before retry.

## Components & file layout

```
backend/src/
├── memory/
│   ├── __init__.py
│   ├── store.py          # thin wrapper over AsyncPostgresStore: read/write namespaced entries
│   ├── tool.py           # the `memory` tool (add/replace/remove + substring matching)
│   ├── security.py       # _scan_memory_content port from Hermes
│   ├── prompt_inject.py  # build the two memory blocks from user_id
│   └── summarize.py      # the summary-mode prompt + JSON candidate parser
└── agent.py              # wire memory tool + prompt-inject hook into create_deep_agent

frontend/agent-chat-ui/src/
├── components/thread/
│   ├── memory-summarize-button.tsx     # the 💾 button next to input
│   └── memory-candidates-interrupt.tsx # renders the HITL panel
└── lib/
    └── memory.ts                       # types + helpers (extend agent-inbox-interrupt union)
```

## Open questions / risks

1. **DeepAgents prompt-injection hook** — `create_deep_agent` accepts `system_prompt` as a static string. We need either (a) a pre-graph middleware that mutates the prompt per-thread, or (b) compute the augmented prompt inside an auth/init hook. To confirm with a small spike before the plan is final.
2. **`init_db.py` on first deploy** — currently a manual one-shot. We may want to run it on container start (idempotent) so deployers don't forget. Out of scope for the memory feature itself but worth flagging.
3. **Summary quality** — depends on the supervisor prompt. We'll add a `prompts/summarize_memory.md` with explicit instructions: extract durable facts only, skip ephemeral details, max 5 candidates.
4. **Token budget at thread start** — 2,200 + 1,375 = 3,575 chars max added to system prompt. Acceptable; just worth being aware of when prompt-caching costs are reviewed.

## What success looks like

- Per-user isolation verified by integration test: account A's writes never appear in account B's namespace queries.
- HITL panel: user can uncheck, edit text, confirm; only the checked + edited entries hit the Store.
- New thread: opens, memory blocks render in system prompt, agent answers a question that requires a prior memory entry.
- Char-limit overflow: agent gets a clear error, calls `replace`/`remove` to consolidate, retries successfully.
