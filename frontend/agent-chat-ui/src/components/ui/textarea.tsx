import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-h-16 field-sizing-content bg-transparent px-3 py-2 text-sm",
        "rounded-[2px] border border-[var(--umx-line)]",
        "text-[var(--umx-white)] placeholder:text-[var(--umx-text-dim)]",
        "selection:bg-[var(--umx-acid)] selection:text-[var(--umx-black)]",
        "transition-[border-color,box-shadow] outline-none resize-none",
        "hover:border-[var(--umx-line-strong)]",
        "focus-visible:border-[var(--umx-acid)] focus-visible:shadow-[0_1px_0_0_var(--umx-acid)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:shadow-[0_1px_0_0_var(--destructive)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
