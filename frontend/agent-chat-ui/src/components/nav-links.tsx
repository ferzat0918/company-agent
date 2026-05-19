"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "HOME", labelZh: "主页" },
  { href: "/changelog", label: "CHANGELOG", labelZh: "更新日志" },
  { href: "/profile", label: "PROFILE", labelZh: "个人主页" },
] as const;

/**
 * 顶部菜单的导航链接条 —— 三个页面（聊天 / profile / changelog）共用。
 * 当前页用荧光绿下划线高亮。
 */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {ITEMS.map((it) => {
        const isActive =
          it.href === "/"
            ? pathname === "/"
            : pathname?.startsWith(it.href) ?? false;
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.labelZh}
            className={cn(
              "relative inline-flex h-9 items-center px-3 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
              isActive
                ? "text-[var(--umx-acid)]"
                : "text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]",
            )}
          >
            {it.label}
            {isActive && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 bottom-0.5 h-px bg-[var(--umx-acid)]"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
