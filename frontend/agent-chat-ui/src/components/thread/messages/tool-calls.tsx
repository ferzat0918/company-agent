import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

function isComplexValue(value: any): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

/**
 * UMX 风格 tool 调用块 — 默认折叠成单行 metadata, 点击展开参数表。
 */
function ToolCallCard({ tc }: { tc: NonNullable<AIMessage["tool_calls"]>[number] }) {
  const args = tc.args as Record<string, any>;
  const hasArgs = Object.keys(args).length > 0;
  const argCount = Object.keys(args).length;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-[2px] border border-[var(--umx-line)]">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-[var(--umx-bg-1)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--umx-bg-2)]"
      >
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-[var(--umx-text-dim)]"
        >
          <ChevronRight className="size-3.5" />
        </motion.span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--umx-silver)]">
          TOOL ·
        </span>
        <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--umx-white)]">
          {tc.name}
        </span>
        {hasArgs && (
          <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--umx-text-dim)]">
            ({argCount} {argCount === 1 ? "arg" : "args"})
          </span>
        )}
        {tc.id && (
          <code className="ml-auto truncate max-w-[160px] font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--umx-text-dim)]">
            {tc.id}
          </code>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden border-t border-[var(--umx-line)]"
          >
            {hasArgs ? (
              <table className="min-w-full divide-y divide-[var(--umx-line)]">
                <tbody className="divide-y divide-[var(--umx-line)]">
                  {Object.entries(args).map(([key, value], argIdx) => (
                    <tr key={argIdx}>
                      <td className="w-1/4 px-3 py-1.5 font-mono text-[11px] font-medium whitespace-nowrap text-[var(--umx-white)] align-top">
                        {key}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-[var(--umx-silver)]">
                        {isComplexValue(value) ? (
                          <code className="block whitespace-pre-wrap rounded-[2px] bg-[var(--umx-bg-2)] px-2 py-1 font-mono text-xs text-[var(--umx-silver)] break-all">
                            {JSON.stringify(value, null, 2)}
                          </code>
                        ) : (
                          String(value)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <code className="block p-3 font-mono text-xs text-[var(--umx-text-dim)]">
                {"{}"}
              </code>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ToolCalls({
  toolCalls,
}: {
  toolCalls: AIMessage["tool_calls"];
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-1">
      {toolCalls.map((tc, idx) => (
        <ToolCallCard key={tc.id ?? idx} tc={tc} />
      ))}
    </div>
  );
}

/**
 * UMX 风格 tool result — 默认折叠成单行, 点击展开详情。
 * 长内容内部仍保留 "expand all" 子按钮。
 */
export function ToolResult({ message }: { message: ToolMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);

  let parsedContent: any;
  let isJsonContent = false;

  try {
    if (typeof message.content === "string") {
      parsedContent = JSON.parse(message.content);
      isJsonContent = isComplexValue(parsedContent);
    }
  } catch {
    parsedContent = message.content;
  }

  const contentStr = isJsonContent
    ? JSON.stringify(parsedContent, null, 2)
    : String(message.content);
  const contentLines = contentStr.split("\n");
  const shouldTruncate = contentLines.length > 4 || contentStr.length > 500;
  const displayedContent =
    shouldTruncate && !isFullyExpanded
      ? contentStr.length > 500
        ? contentStr.slice(0, 500) + "..."
        : contentLines.slice(0, 4).join("\n") + "\n..."
      : contentStr;

  // 单行摘要 (折叠时显示)
  const summary = isJsonContent
    ? Array.isArray(parsedContent)
      ? `${parsedContent.length} item${parsedContent.length === 1 ? "" : "s"}`
      : `${Object.keys(parsedContent).length} field${Object.keys(parsedContent).length === 1 ? "" : "s"}`
    : `${contentStr.length} chars`;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-[2px] border border-[var(--umx-line)]">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex w-full items-center gap-2 bg-[var(--umx-bg-1)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--umx-bg-2)]"
        >
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-[var(--umx-text-dim)]"
          >
            <ChevronRight className="size-3.5" />
          </motion.span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--umx-acid)]">
            RESULT ·
          </span>
          {message.name && (
            <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--umx-white)]">
              {message.name}
            </span>
          )}
          <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--umx-text-dim)]">
            {summary}
          </span>
          {message.tool_call_id && (
            <code className="ml-auto truncate max-w-[160px] font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--umx-text-dim)]">
              {message.tool_call_id}
            </code>
          )}
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden border-t border-[var(--umx-line)] bg-[var(--umx-bg-2)]"
            >
              <div className="p-3">
                {isJsonContent ? (
                  <table className="min-w-full divide-y divide-[var(--umx-line)]">
                    <tbody className="divide-y divide-[var(--umx-line)]">
                      {(Array.isArray(parsedContent)
                        ? isFullyExpanded
                          ? parsedContent
                          : parsedContent.slice(0, 5)
                        : Object.entries(parsedContent)
                      ).map((item, argIdx) => {
                        const [key, value] = Array.isArray(parsedContent)
                          ? [argIdx, item]
                          : [item[0], item[1]];
                        return (
                          <tr key={argIdx}>
                            <td className="w-1/4 px-3 py-1.5 font-mono text-[11px] font-medium whitespace-nowrap text-[var(--umx-white)] align-top">
                              {key}
                            </td>
                            <td className="px-3 py-1.5 text-sm text-[var(--umx-silver)]">
                              {isComplexValue(value) ? (
                                <code className="block whitespace-pre-wrap rounded-[2px] bg-[var(--umx-bg-1)] px-2 py-1 font-mono text-xs text-[var(--umx-silver)] break-all">
                                  {JSON.stringify(value, null, 2)}
                                </code>
                              ) : (
                                String(value)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <code className="block whitespace-pre-wrap font-mono text-xs text-[var(--umx-silver)]">
                    {displayedContent}
                  </code>
                )}
              </div>
              {((shouldTruncate && !isJsonContent) ||
                (isJsonContent &&
                  Array.isArray(parsedContent) &&
                  parsedContent.length > 5)) && (
                <button
                  type="button"
                  onClick={() => setIsFullyExpanded((v) => !v)}
                  className="flex w-full items-center justify-center border-t border-[var(--umx-line)] py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)] transition-colors hover:bg-[var(--umx-bg-3)] hover:text-[var(--umx-silver)]"
                >
                  {isFullyExpanded ? "▴ COLLAPSE" : "▾ SHOW ALL"}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
