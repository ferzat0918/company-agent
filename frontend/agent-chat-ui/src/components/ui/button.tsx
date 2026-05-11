import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[2px] font-display font-bold uppercase tracking-[0.12em]",
    "transition-[background-color,color,border-color] duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    "outline-none focus-visible:ring-1 focus-visible:ring-[var(--umx-acid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--umx-bg-0)]",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--umx-white)] text-[var(--umx-black)] hover:bg-[var(--umx-silver)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110",
        outline:
          "border border-[var(--umx-line-strong)] bg-transparent text-[var(--umx-white)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)]",
        secondary:
          "bg-[var(--umx-bg-2)] text-[var(--umx-white)] hover:bg-[var(--umx-bg-3)]",
        ghost:
          "bg-transparent text-[var(--umx-white)] hover:bg-[var(--umx-bg-2)]",
        link: "text-[var(--umx-acid)] underline-offset-4 hover:underline normal-case tracking-normal",
        acid: "bg-[var(--umx-acid)] text-[var(--umx-black)] hover:brightness-110",
        violet:
          "bg-[var(--umx-violet)] text-[var(--umx-white)] hover:brightness-110",
        /**
         * @deprecated 保留以兼容旧用法 — 等同于 default
         */
        brand:
          "bg-[var(--umx-white)] text-[var(--umx-black)] hover:bg-[var(--umx-silver)]",
      },
      size: {
        default: "h-9 px-5 py-2 text-xs has-[>svg]:px-3",
        sm: "h-7 gap-1.5 px-3 text-[10px] tracking-[0.18em] has-[>svg]:px-2",
        lg: "h-11 px-7 text-sm has-[>svg]:px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
