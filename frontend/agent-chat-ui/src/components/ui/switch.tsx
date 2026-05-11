import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * UMX Switch — 机械感矩形开关。
 * checked = ON · Light (荧光绿底)
 * unchecked = OFF · Dark (深色面板)
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-10 shrink-0 items-center",
        "rounded-[2px] border border-[var(--umx-line-strong)]",
        "transition-colors duration-150 outline-none",
        "focus-visible:ring-1 focus-visible:ring-[var(--umx-acid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--umx-bg-0)]",
        "data-[state=checked]:bg-[var(--umx-acid)] data-[state=checked]:border-[var(--umx-acid)]",
        "data-[state=unchecked]:bg-[var(--umx-bg-2)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3 rounded-[1px]",
          "transition-transform duration-150",
          "data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-[var(--umx-black)]",
          "data-[state=unchecked]:translate-x-[2px] data-[state=unchecked]:bg-[var(--umx-silver)]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
