# Company Agent

公司内部智能体，面向全员提供基于公司知识资产的协作助手。

## 状态

当前阶段：**设计 spec 已完成，待用户复核 → 实施计划**

设计文档：[docs/superpowers/specs/2026-05-09-company-agent-design.md](docs/superpowers/specs/2026-05-09-company-agent-design.md)

## 技术栈（概览）

- **Agent 编排**：LangGraph + Deep Agents
- **LLM**：DeepSeek V4 Flash（主力）/ V4 Pro（升级）
- **前端**：langchain-ai/agent-chat-ui (Next.js)
- **Auth + DB**：Supabase Self-Hosted
- **Observability**：LangSmith
- **部署**：公司内网，Windows 11 + WSL2 + Docker Desktop

## 目录约定

```
/skills/      # Agent Skills（按需加载）
/prompts/     # System Prompt 模板（始终在线）
/backend/     # LangGraph Server 代码
/frontend/    # Agent Chat UI fork
/docs/        # 设计文档与规范
/infra/       # docker-compose / 部署脚本
```

具体内容随实施阶段填充。
