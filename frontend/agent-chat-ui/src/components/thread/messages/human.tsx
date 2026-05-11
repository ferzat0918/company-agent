import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { useState } from "react";
import { getContentString } from "../utils";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { BranchSwitcher, CommandBar } from "./shared";
import { MultimodalPreview } from "@/components/thread/MultimodalPreview";
import { isBase64ContentBlock } from "@/lib/multimodal-utils";

function EditableContent({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="focus-visible:ring-0"
    />
  );
}

export function HumanMessage({
  message,
  isLoading,
}: {
  message: Message;
  isLoading: boolean;
}) {
  const thread = useStreamContext();
  const meta = thread.getMessagesMetadata(message);
  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const contentString = getContentString(message.content);

  const handleSubmitEdit = () => {
    setIsEditing(false);

    const newMessage: Message = { type: "human", content: value };
    thread.submit(
      { messages: [newMessage] },
      {
        checkpoint: parentCheckpoint,
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => {
          const values = meta?.firstSeenState?.values;
          if (!values) return prev;

          return {
            ...values,
            messages: [...(values.messages ?? []), newMessage],
          };
        },
      },
    );
  };

  return (
    <div
      className={cn(
        "group ml-auto flex w-full items-start gap-2 justify-end",
        isEditing && "max-w-xl",
      )}
    >
      <div
        className={cn(
          "flex flex-col items-end gap-2 max-w-[78%]",
          isEditing && "w-full max-w-full",
        )}
      >
        {isEditing ? (
          <EditableContent
            value={value}
            setValue={setValue}
            onSubmit={handleSubmitEdit}
          />
        ) : (
          <>
            {/* USER tag */}
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]">
              USER ·
            </div>
            <div className="flex flex-col items-end gap-2 w-full">
              {/* Render images and files if no text */}
              {Array.isArray(message.content) && message.content.length > 0 && (
                <div className="flex flex-wrap items-end justify-end gap-2">
                  {message.content.reduce<React.ReactNode[]>(
                    (acc, block, idx) => {
                      if (isBase64ContentBlock(block)) {
                        acc.push(
                          <MultimodalPreview
                            key={idx}
                            block={block}
                            size="md"
                          />,
                        );
                      }
                      return acc;
                    },
                    [],
                  )}
                </div>
              )}
              {/* Text: right-aligned, silver right-border line */}
              {contentString ? (
                <p className="border-r-2 border-[var(--umx-silver)] pr-4 text-right whitespace-pre-wrap text-[var(--umx-white)] leading-relaxed">
                  {contentString}
                </p>
              ) : null}
            </div>
          </>
        )}

        <div
          className={cn(
            "ml-auto flex items-center gap-2 transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            isEditing && "opacity-100",
          )}
        >
          <BranchSwitcher
            branch={meta?.branch}
            branchOptions={meta?.branchOptions}
            onSelect={(branch) => thread.setBranch(branch)}
            isLoading={isLoading}
          />
          <CommandBar
            isLoading={isLoading}
            content={contentString}
            isEditing={isEditing}
            setIsEditing={(c) => {
              if (c) {
                setValue(contentString);
              }
              setIsEditing(c);
            }}
            handleSubmitEdit={handleSubmitEdit}
            isHumanMessage={true}
          />
        </div>
      </div>
    </div>
  );
}
