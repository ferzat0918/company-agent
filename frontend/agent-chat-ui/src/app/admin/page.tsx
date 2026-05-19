"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bug, Lightbulb, Clock, Paperclip, Search,
  FileText, FileSpreadsheet, Music, Film, Image as ImageIcon,
  Download, ChevronDown, Shield, MessageSquare, Save, X,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { LoginPage } from "@/components/LoginPage";
import type { AttachmentMeta } from "@/components/FeedbackModal";

/* ── Config ────────────────────────────────────────────────────── */

const ADMIN_EMAILS = [
  "freddyferzat@gmail.com",
];

/* ── Types ─────────────────────────────────────────────────────── */

type FeedbackRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  type: "bug" | "feature";
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
  attachments: AttachmentMeta[];
  admin_note: string;
};

type FilterType = "all" | "bug" | "feature";
type FilterStatus = "all" | "submitted" | "accepted" | "in_progress" | "rejected" | "on_hold";

/* ── Status config ─────────────────────────────────────────────── */

const STATUSES = [
  { value: "submitted",   label: "已提交", color: "#8a8a8c", bg: "rgba(138,138,140,0.12)" },
  { value: "accepted",    label: "已受理", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  { value: "in_progress", label: "开发中", color: "#dafc08", bg: "rgba(218,252,8,0.10)" },
  { value: "rejected",    label: "已拒绝", color: "#ff6b6b", bg: "rgba(255,107,107,0.12)" },
  { value: "on_hold",     label: "挂起",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

/* ── Helpers ───────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from("feedback-attachments").getPublicUrl(path);
  return data.publicUrl;
}

function attachmentIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="size-3.5" />;
  if (mime.startsWith("video/")) return <Film className="size-3.5" />;
  if (mime.startsWith("audio/")) return <Music className="size-3.5" />;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return <FileSpreadsheet className="size-3.5" />;
  return <FileText className="size-3.5" />;
}

/* ── Stats Bar ─────────────────────────────────────────────────── */

function StatsBar({ items }: { items: FeedbackRow[] }) {
  const counts = STATUSES.map((s) => ({
    ...s,
    count: items.filter((i) => i.status === s.value).length,
  }));
  const bugCount = items.filter((i) => i.type === "bug").length;
  const featureCount = items.filter((i) => i.type === "feature").length;

  return (
    <div className="flex flex-wrap gap-3">
      {/* Total */}
      <div
        className="flex items-center gap-2 px-3 py-2 font-mono text-[11px]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--umx-line)",
          borderRadius: "2px",
          color: "var(--umx-white)",
        }}
      >
        <span className="uppercase tracking-[0.1em] text-[var(--umx-text-dim)]">TOTAL</span>
        <span className="font-bold">{items.length}</span>
      </div>

      {/* Type counts */}
      <div className="flex items-center gap-2 px-3 py-2 font-mono text-[11px]"
        style={{ background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: "2px" }}>
        <Bug className="size-3 text-[#ff6b6b]" />
        <span style={{ color: "#ff6b6b" }}>{bugCount}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 font-mono text-[11px]"
        style={{ background: "rgba(218,252,8,0.04)", border: "1px solid rgba(218,252,8,0.2)", borderRadius: "2px" }}>
        <Lightbulb className="size-3 text-[var(--umx-acid)]" />
        <span style={{ color: "var(--umx-acid)" }}>{featureCount}</span>
      </div>

      {/* Status counts */}
      {counts.map((s) => (
        <div
          key={s.value}
          className="flex items-center gap-2 px-3 py-2 font-mono text-[11px]"
          style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: "2px" }}
        >
          <span className="inline-block size-1.5 rounded-full" style={{ background: s.color }} />
          <span style={{ color: s.color }}>{s.label}</span>
          <span className="font-bold" style={{ color: s.color }}>{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Status Dropdown ───────────────────────────────────────────── */

function StatusDropdown({
  currentStatus,
  onSelect,
  disabled,
}: {
  currentStatus: string;
  onSelect: (status: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_MAP[currentStatus] ?? STATUS_MAP.submitted;

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
        style={{
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.color}55`,
          borderRadius: "2px",
          cursor: disabled ? "wait" : "pointer",
        }}
      >
        <span className="inline-block size-1.5 rounded-full" style={{ background: cfg.color }} />
        {cfg.label}
        <ChevronDown className="size-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 top-full z-30 mt-1 min-w-[120px] border border-[var(--umx-line)] bg-[var(--umx-bg-1)] py-1 shadow-lg"
            style={{ borderRadius: "2px" }}
          >
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onSelect(s.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors hover:bg-[var(--umx-bg-2)]"
                style={{
                  color: s.value === currentStatus ? s.color : "var(--umx-silver)",
                }}
              >
                <span className="inline-block size-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close overlay */}
      {open && (
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

/* ── Admin Note Inline Editor ──────────────────────────────────── */

function AdminNoteEditor({
  feedbackId,
  initialNote,
}: {
  feedbackId: string;
  initialNote: string;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase
      .from("feedback")
      .update({ admin_note: note, updated_at: new Date().toISOString() })
      .eq("id", feedbackId);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--umx-text-dim)] transition-colors hover:text-[var(--umx-acid)]"
      >
        <MessageSquare className="size-3" />
        {note ? (
          <span className="max-w-[200px] truncate text-[var(--umx-silver)]">{note}</span>
        ) : (
          <span>添加备注</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="管理员备注..."
        autoFocus
        className="w-48 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-2 py-1 font-body text-[11px] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)]"
        style={{ borderRadius: "2px" }}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <button onClick={save} disabled={saving}
        className="text-[var(--umx-acid)] transition-colors hover:text-white">
        <Save className="size-3.5" />
      </button>
      <button onClick={() => { setNote(initialNote); setEditing(false); }}
        className="text-[var(--umx-text-dim)] transition-colors hover:text-white">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ── Attachment Chips ──────────────────────────────────────────── */

function AttachmentChips({ attachments }: { attachments: AttachmentMeta[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map((att) => {
        const isImage = att.type.startsWith("image/");
        return (
          <a
            key={att.path}
            href={getPublicUrl(att.path)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 border border-[var(--umx-line)] px-2 py-1 font-mono text-[9px] text-[var(--umx-silver)] transition-colors hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)]"
            style={{ borderRadius: "2px" }}
          >
            {isImage ? (
              <img
                src={getPublicUrl(att.path)}
                alt={att.name}
                className="size-4 rounded-sm object-cover"
              />
            ) : (
              attachmentIcon(att.type)
            )}
            <span className="max-w-[80px] truncate">{att.name}</span>
            <span className="text-[var(--umx-text-dim)]">{humanSize(att.size)}</span>
            <Download className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        );
      })}
    </div>
  );
}

/* ── Feedback Table Row ────────────────────────────────────────── */

function FeedbackTableRow({
  item,
  onStatusChange,
}: {
  item: FeedbackRow;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("feedback")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setUpdating(false);
    if (!error) onStatusChange(item.id, newStatus);
  };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-[var(--umx-line)] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
    >
      {/* Type */}
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ color: item.type === "bug" ? "#ff6b6b" : "var(--umx-acid)" }}
        >
          {item.type === "bug" ? <Bug className="size-3" /> : <Lightbulb className="size-3" />}
          {item.type === "bug" ? "BUG" : "FEAT"}
        </span>
      </td>

      {/* User */}
      <td className="px-4 py-3">
        <span className="font-mono text-[11px] text-[var(--umx-silver)]">
          {item.user_email || item.user_id.slice(0, 8) + "..."}
        </span>
      </td>

      {/* Content */}
      <td className="max-w-xs px-4 py-3">
        <p className="line-clamp-2 font-body text-xs leading-relaxed text-[var(--umx-silver)]">
          {item.content}
        </p>
        <AttachmentChips attachments={item.attachments} />
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusDropdown
          currentStatus={item.status}
          onSelect={handleStatusChange}
          disabled={updating}
        />
      </td>

      {/* Admin Note */}
      <td className="px-4 py-3">
        <AdminNoteEditor feedbackId={item.id} initialNote={item.admin_note ?? ""} />
      </td>

      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1 text-[var(--umx-text-dim)]">
          <Clock className="size-3" />
          <span className="font-mono text-[10px]">{formatDate(item.created_at)}</span>
        </div>
      </td>
    </motion.tr>
  );
}

/* ── Loading ───────────────────────────────────────────────────── */

function UmxLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--umx-black)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.16em", color: "var(--umx-text-dim)", textTransform: "uppercase" }}>
        LOADING...
      </span>
    </div>
  );
}

/* ── 403 ───────────────────────────────────────────────────────── */

function ForbiddenScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ background: "var(--umx-black)" }}>
      <Shield className="size-12 text-[#ff6b6b]" />
      <h1 className="font-display text-xl font-bold uppercase tracking-[0.14em] text-[var(--umx-white)]">
        ACCESS DENIED
      </h1>
      <p className="font-mono text-[11px] text-[var(--umx-text-dim)]">
        403 — 你没有管理员权限
      </p>
      <Link href="/">
        <Button variant="outline" size="sm">返回首页</Button>
      </Link>
    </div>
  );
}

/* ── Main Content ──────────────────────────────────────────────── */

function AdminContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as FeedbackRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newStatus, updated_at: new Date().toISOString() } : item,
      ),
    );
  };

  // Apply filters
  const filtered = items.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.content.toLowerCase().includes(q) ||
        (item.user_email?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
        <div className="flex items-center gap-3">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            · ADMIN DASHBOARD
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[var(--umx-text-dim)]">
            {user?.email}
          </span>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-3" />
              BACK
            </Button>
          </Link>
        </div>
      </header>

      <div className="px-8 py-8">
        {/* Title */}
        <div className="mb-6 flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-acid)]">§01</span>
          <h2 className="m-0 font-display text-xl font-bold uppercase tracking-[0.14em] text-[var(--umx-white)]">
            FEEDBACK MANAGEMENT
          </h2>
        </div>

        {/* Stats */}
        {!loading && <StatsBar items={items} />}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索内容或邮箱..."
              className="w-60 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] py-2 pl-9 pr-3 font-body text-xs text-[var(--umx-white)] outline-none transition-colors placeholder:text-[var(--umx-text-dim)] focus:border-[var(--umx-acid)]"
              style={{ borderRadius: "2px" }}
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)]"
            style={{ borderRadius: "2px" }}
          >
            <option value="all">ALL TYPES</option>
            <option value="bug">BUG</option>
            <option value="feature">FEATURE</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)]"
            style={{ borderRadius: "2px" }}
          >
            <option value="all">ALL STATUS</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Result count */}
          <span className="font-mono text-[10px] text-[var(--umx-text-dim)]">
            {filtered.length} / {items.length} 条
          </span>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto border border-[var(--umx-line)]" style={{ borderRadius: "2px" }}>
          {loading ? (
            <div className="flex justify-center py-20">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
                LOADING...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="mb-3 size-8 text-[var(--umx-text-dim)]" />
              <p className="font-mono text-[11px] text-[var(--umx-text-dim)]">
                没有匹配的反馈记录
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--umx-line)] bg-[var(--umx-bg-1)]">
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">TYPE</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">USER</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">CONTENT</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">STATUS</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">NOTE</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">DATE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <FeedbackTableRow
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Gate ───────────────────────────────────────────────────────── */

function AdminGate() {
  const { session, user, loading } = useAuth();
  if (loading) return <UmxLoadingScreen />;
  if (!session) return <LoginPage />;
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) return <ForbiddenScreen />;
  return <AdminContent />;
}

export default function AdminPage() {
  return (
    <React.Suspense fallback={<UmxLoadingScreen />}>
      <AuthProvider>
        <AdminGate />
      </AuthProvider>
    </React.Suspense>
  );
}
