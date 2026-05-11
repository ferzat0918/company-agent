import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 bg-transparent px-3 py-1 text-sm",
        "rounded-[2px] border border-[var(--umx-line)]",
        "text-[var(--umx-white)] placeholder:text-[var(--umx-text-dim)]",
        "selection:bg-[var(--umx-acid)] selection:text-[var(--umx-black)]",
        "transition-[border-color,box-shadow] outline-none",
        "hover:border-[var(--umx-line-strong)]",
        "focus-visible:border-[var(--umx-acid)] focus-visible:shadow-[0_1px_0_0_var(--umx-acid)]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--umx-white)]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:shadow-[0_1px_0_0_var(--destructive)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
