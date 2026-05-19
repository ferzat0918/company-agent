"use client";

import { v4 as uuidv4 } from "uuid";
import { Save } from "lucide-react";
import { type Message } from "@langchain/langgraph-sdk";
import { Button } from "@/components/ui/button";
import { useStreamContext } from "@/providers/Stream";

/**
 * 💾 按钮 —— 触发 AI 把当前对话里值得长期记住的事**静默**写入记忆。
 *
 * 做法：发一个隐藏 human message `__summarize_memory__`；supervisor.md 里
 * 有匹配规则，看到就扫描对话、循环调用 memory.add(...)，最后回一句
 * "已记住 N 条"。没有 HITL 候选审核面板，没有 interrupt —— 简单直接。
 */
export function MemorySummarizeButton() {
  const stream = useStreamContext();
  const isLoading = stream.isLoading;

  const onClick = () => {
    if (isLoading) return;
    const triggerMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: "__summarize_memory__",
    };
    stream.submit({ messages: [triggerMessage] });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="总结记忆"
      title="把当前对话里值得长期记住的事写入记忆"
      onClick={onClick}
      disabled={isLoading}
      className="size-9 text-[var(--umx-text-dim)] hover:text-[var(--umx-acid)]"
    >
      <Save className="size-4" />
    </Button>
  );
}
