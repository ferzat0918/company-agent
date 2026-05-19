"use client";

import { toast } from "sonner";
import type { MemorySavedEvent } from "@/lib/memory";

const TARGET_LABELS: Record<MemorySavedEvent["target"], string> = {
  user: "USER",
  memory: "MEMORY",
};

/**
 * 显示一条带"撤销"按钮的 toast。5 秒自动消失。
 * AI 自主调 memory.add 成功后由后端推 memory_saved 事件触发。
 */
export function showMemorySavedToast(
  event: MemorySavedEvent,
  onUndo: (key: string, target: MemorySavedEvent["target"]) => void,
): void {
  toast(`已记住 [${TARGET_LABELS[event.target]}]`, {
    description: event.content,
    duration: 5000,
    action: {
      label: "撤销",
      onClick: () => onUndo(event.key, event.target),
    },
  });
}
