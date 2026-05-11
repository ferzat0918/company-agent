import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * UMX Chip — 机械感小标签。
 * 用途：SubAgent 标识、skill 命中提示、状态徽章、metadata 显示。
 * 默认使用 mono 字体 + UPPERCASE + tracking。
 */
const chipVariants = cva(
  [
    "inline-flex items-center gap-1.5 whitespace-nowrap",
    "rounded-[2px] px-2 py-0.5",
    "font-mono text-[10px] tracking-[0.18em] uppercase leading-none",
    "transition-colors duration-150",
  ].join(" "),
  {
    variants: {
      variant: {
        outline:
          "border border-[var(--umx-line-strong)] bg-transparent text-[var(--umx-silver)]",
        solid:
          "bg-[var(--umx-bg-2)] text-[var(--umx-silver)] border border-[var(--umx-line)]",
        acid:
          "bg-[var(--umx-acid)] text-[var(--umx-black)] border border-[var(--umx-acid)]",
        violet:
          "bg-[var(--umx-violet)] text-[var(--umx-white)] border border-[var(--umx-violet)]",
        muted:
          "bg-transparent text-[var(--umx-text-dim)] border border-transparent",
      },
      size: {
        sm: "h-5 px-1.5 text-[9px]",
        default: "h-6 px-2 text-[10px]",
        lg: "h-7 px-2.5 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

type ChipProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chipVariants> & {
    asChild?: boolean;
    /** 在文字前面渲染一个状态指示块（█），用于"已激活"语义 */
    pulse?: boolean;
  };

function Chip({
  className,
  variant,
  size,
  pulse,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      data-slot="chip"
      className={cn(chipVariants({ variant, size, className }))}
      {...props}
    >
      {pulse ? (
        <span
          aria-hidden
          className="inline-block size-2 bg-current"
          style={{ animation: "umx-blink 1s steps(2) infinite" }}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Chip, chipVariants, type ChipProps };
