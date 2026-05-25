"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { supabase } from "@/lib/supabase";
import { LoginPage } from "@/components/LoginPage";
import { NavLinks } from "@/components/nav-links";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type FinanceProfile = {
  user_id: string;
  dept: string | null;
  role: string | null;
};

const FinanceProfileContext = createContext<FinanceProfile | null>(null);

export function useFinanceProfile() {
  return useContext(FinanceProfileContext);
}

/* ── Sub-nav (6 个财务子页面) ─────────────────────────────── */

const SUB_ITEMS = [
  { href: "/finance",                label: "DASHBOARD",   labelZh: "库存总览" },
  { href: "/finance/products",       label: "PRODUCTS",    labelZh: "成品档案" },
  { href: "/finance/materials",      label: "MATERIALS",   labelZh: "原料档案" },
  { href: "/finance/boms",           label: "BOM",         labelZh: "BOM 配方" },
  { href: "/finance/moves",          label: "MOVES",       labelZh: "出入库流水" },
  { href: "/finance/import-export",  label: "IO",          labelZh: "导入 / 导出" },
] as const;

function FinanceSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0 border-b border-[var(--umx-line)] bg-[var(--umx-bg-1)] px-8">
      {SUB_ITEMS.map((it) => {
        const isActive =
          it.href === "/finance"
            ? pathname === "/finance"
            : pathname?.startsWith(it.href) ?? false;
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.labelZh}
            className={cn(
              "relative inline-flex h-11 items-center px-4 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
              isActive
                ? "text-[var(--umx-acid)]"
                : "text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]",
            )}
          >
            <span className="mr-2 text-[var(--umx-text-dim)]">
              {String(SUB_ITEMS.indexOf(it) + 1).padStart(2, "0")}
            </span>
            <span>{it.label}</span>
            <span className="ml-2 hidden text-[var(--umx-text-dim)] md:inline">
              · {it.labelZh}
            </span>
            {isActive && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 -bottom-px h-px bg-[var(--umx-acid)]"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Loading / Forbidden screens ─────────────────────────── */

function FinanceLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--umx-bg-0)" }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
        INITIALIZING FINANCE WORKSPACE...
      </span>
    </div>
  );
}

function FinanceForbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--umx-bg-0)] px-6 text-center">
      <Lock className="mb-6 size-10 text-[var(--umx-text-dim)]" />
      <h1 className="m-0 mb-3 font-display text-2xl uppercase tracking-[0.14em] text-[var(--umx-white)]">
        ACCESS DENIED
      </h1>
      <p className="mb-1 max-w-md font-body text-sm leading-relaxed text-[var(--umx-silver)]">
        财务工作台仅向 <span className="text-[var(--umx-acid)]">财务部</span> 与{" "}
        <span className="text-[var(--umx-acid)]">系统管理员</span> 开放。
      </p>
      <p className="mb-8 max-w-md font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--umx-text-dim)]">
        Need access? Contact the system administrator.
      </p>
      <Link href="/profile">
        <Button variant="outline" size="lg">
          ← BACK TO PROFILE
        </Button>
      </Link>
    </main>
  );
}

/* ── Gate & shell ─────────────────────────────────────────── */

function FinanceShell({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuth();
  const [profile, setProfile] = useState<FinanceProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, dept, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setProfile((data as FinanceProfile) ?? null);
        setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading || (session && profileLoading)) return <FinanceLoading />;
  if (!session) return <LoginPage />;

  const isFinance =
    profile?.dept === "财务部" || profile?.role === "系统管理员";
  if (!isFinance) return <FinanceForbidden />;

  return (
    <FinanceProfileContext.Provider value={profile}>
      <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)]">
        {/* 顶栏 */}
        <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <UmxSymbol size={28} className="text-[var(--umx-white)]" />
            <UmxWordmark size={22} />
            <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
              · COMPANY AGENT / FINANCE
            </span>
          </Link>
          <NavLinks />
        </header>

        {/* 财务子导航 */}
        <FinanceSubNav />

        {/* 页面正文 */}
        <div className="px-8 py-10">{children}</div>
      </main>
    </FinanceProfileContext.Provider>
  );
}

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<FinanceLoading />}>
      <AuthProvider>
        <FinanceShell>{children}</FinanceShell>
      </AuthProvider>
    </React.Suspense>
  );
}
