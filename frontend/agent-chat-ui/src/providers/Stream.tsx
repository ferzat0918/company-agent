import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { useThreads } from "./Thread";
import { useAuth } from "./Auth";
import { toast } from "sonner";
import {
  isMemorySavedEvent,
  type MemorySavedEvent,
} from "@/lib/memory";
import { showMemorySavedToast } from "@/components/thread/memory-toast";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      context?: Record<string, unknown>;
    };
    CustomEventType: UIMessage | RemoveUIMessage | MemorySavedEvent;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  token: string | null,
): Promise<boolean> {
  try {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${apiUrl}/info`, {
      headers,
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const HARDCODED_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/agent/v1`
    : "/agent/v1");
const HARDCODED_ASSISTANT_ID =
  process.env.NEXT_PUBLIC_ASSISTANT_ID ?? "company_agent";

const StreamSession = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  // Captures the latest streamValue so onCustomEvent (defined in the same
  // useTypedStream config) can reach submit/etc without a circular ref.
  const submitRef = useRef<((input: Record<string, unknown>) => void) | null>(
    null,
  );

  const streamValue = useTypedStream({
    apiUrl: HARDCODED_API_URL,
    assistantId: HARDCODED_ASSISTANT_ID,
    threadId: threadId ?? null,
    fetchStateHistory: true,
    // Pass the Supabase JWT as Authorization header
    defaultHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
    onCustomEvent: (event, options) => {
      if (isMemorySavedEvent(event)) {
        showMemorySavedToast(event, (key, target) => {
          // Send a hidden user message that supervisor.md recognises and
          // routes to the memory_undo tool. Falls back silently if the
          // stream isn't ready yet (shouldn't happen in practice).
          submitRef.current?.({
            messages: [
              { role: "user", content: `__undo_memory__:${target}:${key}` },
            ],
          });
        });
        return;
      }
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
    onThreadId: (id) => {
      setThreadId(id);
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });

  // Keep the submit ref pointed at the latest stream value so the
  // onCustomEvent callback above can call it.
  useEffect(() => {
    submitRef.current = streamValue.submit as unknown as (
      input: Record<string, unknown>,
    ) => void;
  }, [streamValue.submit]);

  useEffect(() => {
    checkGraphStatus(HARDCODED_API_URL, token).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at{" "}
              <code>{HARDCODED_API_URL}</code>.
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [token]);

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return <StreamSession>{children}</StreamSession>;
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
