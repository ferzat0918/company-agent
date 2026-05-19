"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Bug, Lightbulb, Clock } from "lucide-react";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { LoginPage } from "@/components/LoginPage";

/* ── Types ─────────────────────────────────────────────────────── */

type FeedbackRow = {
  id: string;
  type: "bug" | "feature";
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/* ── Status config ─────────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  submitted:   { label: "已提交", color: "#8a8a8c", bg: "rgba(138,138,140,0.12)" },
  accepted:    { label: "已受理", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  in_progress: { label: "开发中", color: "#dafc08", bg: "rgba(218,252,8,0.10)" },
  rejected:    { label: "已拒绝", color: "#ff6b6b", bg: "rgba(255,107,107,0.12)" },
  on_hold:     { label: "挂起",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.submitted;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        borderRadius: "2px",
      }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: "bug" | "feature" }) {
  const isBug = type === "bug";
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]"
      style={{ color: isBug ? "#ff6b6b" : "var(--umx-acid)" }}
    >
      {isBug ? <Bug className="size-3" /> : <Lightbulb className="size-3" />}
      {isBug ? "BUG" : "FEATURE"}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── Loading screen ────────────────────────────────────────────── */

function UmxLoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--umx-black)" }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.16em",
          color: "var(--umx-text-dim)",
          textTransform: "uppercase",
        }}
      >
        LOADING...
      </span>
    </div>
  );
}

/* ── Feedback card ─────────────────────────────────────────────── */

function FeedbackCard({ item }: { item: FeedbackRow }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] transition-colors hover:border-[var(--umx-line-strong)]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-[var(--umx-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <TypeBadge type={item.type} />
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-1.5 text-[var(--umx-text-dim)]">
          <Clock className="size-3" />
          <span className="font-mono text-[10px] tracking-wider">
            {formatDate(item.created_at)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-[var(--umx-silver)]">
          {item.content}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Empty state ───────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-4 flex size-16 items-center justify-center border border-[var(--umx-line)] bg-[var(--umx-bg-2)]"
        style={{ borderRadius: "2px" }}
      >
        <Lightbulb className="size-6 text-[var(--umx-text-dim)]" />
      </div>
      <p className="mb-1 font-display text-sm font-bold uppercase tracking-[0.12em] text-[var(--umx-white)]">
        暂无反馈记录
      </p>
      <p className="font-body text-xs text-[var(--umx-text-dim)]">
        返回个人主页点击"我要反馈"提交你的第一条反馈
      </p>
    </div>
  );
}

/* ── Main content ──────────────────────────────────────────────── */

function FeedbackListContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id, type, content, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!cancelled && !error && data) {
        setItems(data as FeedbackRow[]);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
        <div className="flex items-center gap-3">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            · COMPANY AGENT / MY FEEDBACK
          </span>
        </div>
        <Link href="/profile">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="size-3" />
            BACK TO PROFILE
          </Button>
        </Link>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-8 py-12">
        {/* Section header */}
        <div className="mb-8 flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-acid)]">
            §01
          </span>
          <h2 className="m-0 font-display text-xl font-bold uppercase tracking-[0.14em] text-[var(--umx-white)]">
            MY FEEDBACK
          </h2>
          {!loading && items.length > 0 && (
            <span className="font-mono text-[10px] text-[var(--umx-text-dim)]">
              ({items.length})
            </span>
          )}
        </div>

        {/* Status legend */}
        {!loading && items.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-3">
            {Object.entries(STATUS_MAP).map(([key, cfg]) => (
              <span
                key={key}
                className="font-mono text-[10px] tracking-wider"
                style={{ color: cfg.color }}
              >
                ● {cfg.label}
              </span>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
              LOADING...
            </span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Gate & export ─────────────────────────────────────────────── */

function FeedbackGate() {
  const { session, loading } = useAuth();
  if (loading) return <UmxLoadingScreen />;
  if (!session) return <LoginPage />;
  return <FeedbackListContent />;
}

export default function FeedbackPage() {
  return (
    <React.Suspense fallback={<UmxLoadingScreen />}>
      <AuthProvider>
        <FeedbackGate />
      </AuthProvider>
    </React.Suspense>
  );
}
