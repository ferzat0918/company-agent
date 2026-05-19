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
