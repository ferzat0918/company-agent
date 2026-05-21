import React from "react";
import { File, X as XIcon } from "lucide-react";
import { ContentBlock } from "@langchain/core/messages";
import { cn } from "@/lib/utils";
import Image from "next/image";
export interface MultimodalPreviewProps {
  block: ContentBlock.Multimodal.Data;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const MultimodalPreview: React.FC<MultimodalPreviewProps> = ({
  block,
  removable = false,
  onRemove,
  className,
  size = "md",
}) => {
  // Image block
  if (
    block.type === "image" &&
    typeof block.mimeType === "string" &&
    block.mimeType.startsWith("image/")
  ) {
    const url = `data:${block.mimeType};base64,${block.data}`;
    let imgClass: string = "rounded-md object-cover h-16 w-16 text-lg";
    if (size === "sm") imgClass = "rounded-md object-cover h-10 w-10 text-base";
    if (size === "lg") imgClass = "rounded-md object-cover h-24 w-24 text-xl";
    return (
      <div className={cn("relative inline-block", className)}>
        <Image
          src={url}
          alt={String(block.metadata?.name || "uploaded image")}
          className={imgClass}
          width={size === "sm" ? 16 : size === "md" ? 32 : 48}
          height={size === "sm" ? 16 : size === "md" ? 32 : 48}
        />
        {removable && (
          <button
            type="button"
            className="absolute top-1 right-1 z-10 rounded-[2px] border border-[var(--umx-line-strong)] bg-[var(--umx-bg-2)] p-0.5 text-[var(--umx-silver)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)]"
            onClick={onRemove}
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // File / Document block
  if (block.type === "file") {
    const filename =
      block.metadata?.filename || block.metadata?.name || "file";
    return (
      <div
        className={cn(
          "relative flex items-start gap-2 rounded-[2px] border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2",
          className,
        )}
      >
        <div className="flex flex-shrink-0 flex-col items-start justify-start">
          <File
            className={cn(
              "text-[var(--umx-acid)]",
              size === "sm" ? "h-5 w-5" : "h-7 w-7",
            )}
          />
        </div>
        <span
          className={cn("min-w-0 flex-1 text-sm break-all text-[var(--umx-white)]")}
          style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
        >
          {String(filename)}
        </span>
        {removable && (
          <button
            type="button"
            className="ml-2 self-start rounded-[2px] border border-[var(--umx-line)] bg-[var(--umx-bg-3)] p-1 text-[var(--umx-silver)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)]"
            onClick={onRemove}
            aria-label="Remove file"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[2px] border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 text-[var(--umx-text-dim)]",
        className,
      )}
    >
      <File className="h-5 w-5 flex-shrink-0" />
      <span className="truncate text-xs">Unsupported file type</span>
      {removable && (
        <button
          type="button"
          className="ml-2 rounded-[2px] border border-[var(--umx-line)] bg-[var(--umx-bg-3)] p-1 text-[var(--umx-silver)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)]"
          onClick={onRemove}
          aria-label="Remove file"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
