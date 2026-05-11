import { Copy, CopyCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipIconButton } from "../../tooltip-icon-button";

export function ThreadIdTooltip({ threadId }: { threadId: string }) {
  const firstThreeChars = threadId.slice(0, 3);
  const lastThreeChars = threadId.slice(-3);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <p className="rounded-[2px] border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-1.5 py-[2px] font-mono text-[10px] leading-[12px] tracking-[0.1em] uppercase text-[var(--umx-silver)]">
            {firstThreeChars}...{lastThreeChars}
          </p>
        </TooltipTrigger>
        <TooltipContent>
          <ThreadIdCopyable threadId={threadId} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ThreadIdCopyable({
  threadId,
  showUUID = false,
}: {
  threadId: string;
  showUUID?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    navigator.clipboard.writeText(threadId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipIconButton
      onClick={(e) => handleCopy(e)}
      variant="ghost"
      tooltip="Copy thread ID"
      className="flex w-fit flex-grow-0 cursor-pointer items-center gap-1 rounded-[2px] border-[1px] border-[var(--umx-line)] p-1 hover:border-[var(--umx-acid)] hover:bg-[var(--umx-bg-2)]"
    >
      <p className="font-mono text-xs">{showUUID ? threadId : "ID"}</p>
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        {copied ? (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <CopyCheck className="h-3 max-h-3 w-3 max-w-3 text-[var(--umx-acid)]" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Copy className="h-3 max-h-3 w-3 max-w-3 text-[var(--umx-text-dim)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipIconButton>
  );
}
