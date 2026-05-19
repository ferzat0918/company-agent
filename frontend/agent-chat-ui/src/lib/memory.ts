import type { Client } from "@langchain/langgraph-sdk";

/** 后端 memory tool 调 add 成功后通过 get_stream_writer 推出的事件。 */
export type MemorySavedEvent = {
  kind: "memory_saved";
  key: string;
  target: "memory" | "user";
  content: string;
};

export function isMemorySavedEvent(x: unknown): x is MemorySavedEvent {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { kind?: unknown }).kind === "memory_saved"
  );
}

/**
 * 触发 AI 用 memory_undo 工具撤销指定 key 的记忆。
 *
 * 通过发一个特殊格式的隐藏 user message 实现 —— supervisor.md 里有
 * 对应的识别规则，看到这个前缀就直接调 memory_undo 然后回复"已撤销"。
 */
export async function undoMemorySave(
  client: Client,
  threadId: string,
  assistantId: string,
  key: string,
  target: MemorySavedEvent["target"],
): Promise<void> {
  await client.runs.create(threadId, assistantId, {
    input: {
      messages: [
        {
          role: "user",
          content: `__undo_memory__:${target}:${key}`,
        },
      ],
    },
  });
}
