import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { useAuth } from "@/providers/Auth";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose, SquarePen, LogOut, Trash2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = (Date.now() - date.getTime()) / 1000; // seconds
  if (diff < 60) return "JUST NOW";
  if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}H AGO`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}D AGO`;
  // > 1 week → 显示日期
  return date
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, ".");
}

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { deleteThread } = useThreads();

  const handleDelete = async (
    e: React.MouseEvent,
    tid: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await deleteThread(tid);
      // 如果删除的是当前正在查看的 thread，清空选中
      if (tid === threadId) {
        setThreadId(null);
      }
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  if (threads.length === 0) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-12">
        <div className="umx-dot-grid absolute inset-0 pointer-events-none" />
        <span className="relative font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-text-dim)]">
          NO THREADS YET
        </span>
        <span className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]/60">
          ▾ START A CONVERSATION
        </span>
      </div>
    );
  }

  return (
    <div className="umx-scrollbar flex h-full w-full flex-col items-start justify-start overflow-y-scroll">
      {threads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        const isActive = t.thread_id === threadId;
        const updatedAt = (t as { updated_at?: string }).updated_at;
        const relative = formatRelativeTime(updatedAt);
        const shortId = t.thread_id.slice(0, 8);

        return (
          <button
            key={t.thread_id}
            type="button"
            className={cn(
              "group relative flex w-full flex-col items-start gap-1 border-l-2 px-4 py-2.5 text-left transition-colors",
              isActive
                ? "border-[var(--umx-acid)] bg-[var(--umx-bg-2)]"
                : "border-transparent hover:border-[var(--umx-line-strong)] hover:bg-[var(--umx-bg-2)]/50",
            )}
            onClick={(e) => {
              e.preventDefault();
              onThreadClick?.(t.thread_id);
              if (t.thread_id === threadId) return;
              setThreadId(t.thread_id);
            }}
          >
            <p
              className={cn(
                "w-full truncate pr-6 text-sm leading-tight",
                isActive ? "text-[var(--umx-white)]" : "text-[var(--umx-silver)]",
              )}
            >
              {itemText || "(no content)"}
            </p>
            <div className="flex w-full items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
              <span>{shortId}</span>
              {relative && <span>{relative}</span>}
            </div>
            {/* 删除按钮 — hover 时显示 */}
            <span
              role="button"
              tabIndex={0}
              aria-label="Delete thread"
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer text-[var(--umx-text-dim)] hover:text-[#ff3b3b]"
              onClick={(e) => handleDelete(e, t.thread_id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleDelete(e as unknown as React.MouseEvent, t.thread_id);
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="umx-scrollbar flex h-full w-full flex-col items-start justify-start gap-1 overflow-y-scroll px-2 py-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="w-full px-2 py-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="mt-1.5 h-2 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const { user, signOut } = useAuth();
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [, setThreadId] = useQueryState("threadId");

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, []);

  // 用户邮箱截取 @ 前的部分作为显示名
  const displayName = user?.email?.split("@")[0]?.toUpperCase() ?? "USER";

  const sidebar = (
    <>
      <div className="flex w-full items-center justify-between border-b border-[var(--umx-line)] px-4 py-3">
        <h1 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--umx-white)]">
          ▾ THREADS
          {threads.length > 0 && (
            <span className="ml-2 font-mono text-[10px] tracking-[0.16em] text-[var(--umx-text-dim)]">
              {threads.length}
            </span>
          )}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="New thread"
          onClick={() => setThreadId(null)}
          className="size-7"
        >
          <SquarePen className="size-3.5" />
        </Button>
      </div>
      {threadsLoading ? (
        <ThreadHistoryLoading />
      ) : (
        <ThreadList threads={threads} />
      )}
    </>
  );

  return (
    <>
      <div className="hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start border-r-[1px] border-[var(--umx-line)] bg-[var(--umx-bg-1)] lg:flex">
        <div className="flex w-full items-center justify-between border-b border-[var(--umx-line)] px-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Collapse sidebar"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-4" />
            ) : (
              <PanelRightClose className="size-4" />
            )}
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-text-dim)]">
            {displayName}
          </span>
        </div>
        {sidebar}
        {/* 用户信息 + 退出 — 固定在侧边栏底部 */}
        <div className="mt-auto flex w-full items-center justify-between border-t border-[var(--umx-line)] px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)]">
              {user?.email ?? "user"}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
              AUTHENTICATED
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={signOut}
            className="size-7 shrink-0 text-[var(--umx-text-dim)] hover:text-[var(--umx-acid)]"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>▾ THREADS</SheetTitle>
            </SheetHeader>
            <ThreadList
              threads={threads}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
