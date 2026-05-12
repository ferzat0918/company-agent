import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/langgraph-sdk/react";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { MessageContentComplex } from "@langchain/core/messages";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";
import { useState } from "react";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread as unknown as ReturnType<typeof useStream>}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

  return toolCallContents.map((tc) => {
    const toolCall = tc as Record<string, any>;
    let json: Record<string, any> = {};
    if (toolCall?.input) {
      try {
        json = parsePartialJson(toolCall.input) ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: toolCall.name ?? "",
      id: toolCall.id ?? "",
      args: json,
      type: "tool_call",
    };
  });
}

interface InterruptProps {
  interrupt?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interrupt,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  const fallbackValue = Array.isArray(interrupt)
    ? (interrupt as Record<string, any>[])
    : (((interrupt as { value?: unknown } | undefined)?.value ??
        interrupt) as Record<string, any>);

  return (
    <>
      {isAgentInboxInterruptSchema(interrupt) &&
        (isLastMessage || hasNoAIOrToolMessages) && (
          <ThreadView interrupt={interrupt} />
        )}
      {interrupt &&
      !isAgentInboxInterruptSchema(interrupt) &&
      (isLastMessage || hasNoAIOrToolMessages) ? (
        <GenericInterruptView interrupt={fallbackValue} />
      ) : null}
    </>
  );
}

function getThinkingContent(message: Message | undefined): string {
  if (!message) return "";
  // DeepSeek: additional_kwargs.reasoning_content
  const ak = (message as Record<string, any>).additional_kwargs;
  if (ak?.reasoning_content && typeof ak.reasoning_content === "string") {
    return ak.reasoning_content;
  }
  // Anthropic: content blocks with type "thinking"
  if (Array.isArray(message.content)) {
    const thinking = message.content
      .filter((c: any) => c.type === "thinking" && c.thinking)
      .map((c: any) => c.thinking)
      .join("\n\n");
    if (thinking) return thinking;
  }
  // Also check response_metadata
  const rm = (message as Record<string, any>).response_metadata;
  if (rm?.reasoning_content && typeof rm.reasoning_content === "string") {
    return rm.reasoning_content;
  }
  return "";
}

function ThinkingBlock({
  message,
  hideThinking,
}: {
  message: Message | undefined;
  hideThinking: boolean;
}) {
  const thinking = getThinkingContent(message);
  const [expanded, setExpanded] = useState(false);

  if (!thinking) return null;
  if (hideThinking && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 border-l-2 border-[var(--umx-text-dim)] pl-4 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)] transition-colors hover:text-[var(--umx-acid)]"
      >
        <span>▸ THINKING</span>
        <span className="normal-case tracking-normal text-[9px]">
          ({thinking.length} chars — click to expand)
        </span>
      </button>
    );
  }

  return (
    <div className="border-l-2 border-[var(--umx-text-dim)] pl-4 py-0.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)] transition-colors hover:text-[var(--umx-acid)]"
      >
        <span>{expanded || !hideThinking ? "▾" : "▸"} THINKING</span>
      </button>
      <div className="max-h-[300px] overflow-y-auto rounded-[2px] bg-[var(--umx-bg-2)] p-3 text-[12px] leading-relaxed text-[var(--umx-text-dim)]">
        <MarkdownText>{thinking}</MarkdownText>
      </div>
    </div>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(true),
  );
  const [hideThinking] = useQueryState(
    "hideThinking",
    parseAsBoolean.withDefault(false),
  );

  const thread = useStreamContext();
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = Array.isArray(content)
    ? parseAnthropicStreamedToolCalls(content)
    : undefined;

  const hasToolCalls =
    message &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;
  const toolCallsHaveContents =
    hasToolCalls &&
    message.tool_calls?.some(
      (tc) => tc.args && Object.keys(tc.args).length > 0,
    );
  const hasAnthropicToolCalls = !!anthropicStreamedToolCalls?.length;
  const isToolResult = message?.type === "tool";

  if (isToolResult && hideToolCalls) {
    return null;
  }

  // Hide AI messages that contain only tool calls and no text
  const isToolOnlyMessage =
    !isToolResult &&
    contentString.length === 0 &&
    (hasToolCalls || hasAnthropicToolCalls);
  if (isToolOnlyMessage && hideToolCalls) {
    return null;
  }

  return (
    <div className="group mr-auto flex w-full items-start gap-2">
      <div className="flex w-full max-w-[88%] flex-col gap-2">
        {isToolResult ? (
          <>
            <ToolResult message={message} />
            <Interrupt
              interrupt={threadInterrupt}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
          </>
        ) : (
          <>
            {/* Agent identity tag */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-violet)]">
                █▌ AGENT
              </span>
              <span className="h-px flex-1 bg-[var(--umx-line)]" />
            </div>

            {/* Thinking / Reasoning content */}
            <ThinkingBlock message={message} hideThinking={hideThinking ?? true} />

            {contentString.length > 0 && (
              <div className="border-l-2 border-[var(--umx-violet)] pl-4 py-0.5 text-[var(--umx-white)]">
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            )}

            {!hideToolCalls && (
              <>
                {(hasToolCalls && toolCallsHaveContents && (
                  <ToolCalls toolCalls={message.tool_calls} />
                )) ||
                  (hasAnthropicToolCalls && (
                    <ToolCalls toolCalls={anthropicStreamedToolCalls} />
                  )) ||
                  (hasToolCalls && (
                    <ToolCalls toolCalls={message.tool_calls} />
                  ))}
              </>
            )}

            {message && (
              <CustomComponent
                message={message}
                thread={thread}
              />
            )}
            <Interrupt
              interrupt={threadInterrupt}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
            <div
              className={cn(
                "mr-auto flex items-center gap-2 transition-opacity",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
              )}
            >
              <BranchSwitcher
                branch={meta?.branch}
                branchOptions={meta?.branchOptions}
                onSelect={(branch) => thread.setBranch(branch)}
                isLoading={isLoading}
              />
              <CommandBar
                content={contentString}
                isLoading={isLoading}
                isAiMessage={true}
                handleRegenerate={() => handleRegenerate(parentCheckpoint)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="mr-auto flex w-full max-w-[88%] flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-violet)]">
          █▌ AGENT
        </span>
        <span className="h-px flex-1 bg-[var(--umx-line)]" />
      </div>
      <div className="border-l-2 border-[var(--umx-violet)] pl-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]">
        <span>▸ THINKING</span>
        <span className="inline-flex gap-1">
          <span className="size-1 animate-[pulse_1.5s_ease-in-out_infinite] bg-[var(--umx-acid)]" />
          <span className="size-1 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] bg-[var(--umx-acid)]" />
          <span className="size-1 animate-[pulse_1.5s_ease-in-out_1s_infinite] bg-[var(--umx-acid)]" />
        </span>
      </div>
    </div>
  );
}
