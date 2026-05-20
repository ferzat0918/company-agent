"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bug, Lightbulb, Clock, Paperclip, Search,
  FileText, FileSpreadsheet, Music, Film, Image as ImageIcon,
  Download, ChevronDown, Shield, MessageSquare, Save, X, Trash2, Timer,
  Copy, Sparkles, DownloadCloud, FileJson, CheckSquare, Square, Info
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

const REJECTED_TTL_DAYS = 30;

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

/* ── UMX Realistic Mock Data ────────────────────────────────────── */

const UMX_MOCK_FEEDBACKS = [
  {
    type: "bug",
    content: "TV STAND 65in 的声光电交互系统在暗光环境下，环境氛围灯在开启 Light 模式时偶发频闪，且与音响的蓝牙音频同步有约 150ms 延迟。建议优化控制电路固件。",
    status: "submitted",
    admin_note: "已确认此频闪是由供电模块波动引起，固件开发组正在排查。"
  },
  {
    type: "feature",
    content: "希望为 75in TV STAND 模块化包装架构系统提供额外的电镀银（Chrome Silver）金属侧板配件，以增强赛博朋克重工业风的机械美学质感。",
    status: "accepted",
    admin_note: "工业设计团队已启动配件打样，预计下个季度上线选配商城。"
  },
  {
    type: "bug",
    content: "使用 Google Sans Code 辅助字体在官网规格表展示 TV STAND 尺寸 (1680×500×1715mm) 时，在 2K 显示器下边框线条存在 0.5px 的渲染偏差，导致机械线框分割视觉上不够锐利。",
    status: "in_progress",
    admin_note: "前端样式微调中，使用 transform-gpu 加速并强制像素对齐。"
  },
  {
    type: "feature",
    content: "建议开发一款适配 UMX 智能家居的声光互动手机 App，能够通过声纹控制滑雪装备干燥架的烘干强度，并在毛玻璃发光面板上动态映射雪道降雪量数据。",
    status: "on_hold",
    admin_note: "想法极具想象力！涉及声光电跨硬件交互，先挂起作为年度先锋探索项目储备。"
  },
  {
    type: "bug",
    content: "滑雪板挂墙支架（Ski Wall Mount）哑光金属喷涂表面较易吸附指纹，在湿润环境下防锈涂层边缘偶有微小氧化点，需要强化防潮工艺。",
    status: "submitted",
    admin_note: ""
  },
  {
    type: "feature",
    content: "期待在官网页面中集成一个更硬核的 Retro-Futurism 互动 3D 样机展示系统，允许用户实时拆解 5×9 模块网格支架，自定义拼装声光电插件组件。",
    status: "accepted",
    admin_note: "已立项，Web3D 小组正在使用 WebGL 制作高精度金属反光模型。"
  }
];

/* ── Helpers ───────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysUntilAutoDelete(updatedAt: string): number {
  const updated = new Date(updatedAt).getTime();
  const deadline = updated + REJECTED_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000)));
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

/* ── Analytics Visualizer Dashboard ─────────────────────────────── */

function AnalyticsDashboard({ items }: { items: FeedbackRow[] }) {
  const total = items.length;
  const bugs = items.filter((i) => i.type === "bug").length;
  const features = items.filter((i) => i.type === "feature").length;

  const bugPercent = total > 0 ? Math.round((bugs / total) * 100) : 0;
  const featPercent = total > 0 ? Math.round((features / total) * 100) : 0;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const bugOffset = circumference - (bugPercent / 100) * circumference;
  const featOffset = circumference - (featPercent / 100) * circumference;

  const resolved = items.filter((i) => ["accepted", "in_progress"].includes(i.status)).length;
  const resolvedPercent = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <div
      className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3"
      style={{
        background: "rgba(0,0,0,0.4)",
        border: "1px solid var(--umx-line)",
        borderRadius: "2px",
        padding: "20px",
      }}
    >
      {/* Bug gauge */}
      <div className="flex items-center gap-4 border-r border-[var(--umx-line)] pr-4 last:border-none md:border-r">
        <div className="relative size-16 shrink-0">
          <svg className="size-full -rotate-90">
            <circle cx="32" cy="32" r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth="3.5" fill="transparent" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#ff6b6b"
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={bugOffset}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(255,107,107,0.3))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <span className="text-[12px] font-bold text-[#ff6b6b]">{bugPercent}%</span>
            <span className="text-[6px] tracking-wider text-[var(--umx-text-dim)] uppercase">故障率</span>
          </div>
        </div>
        <div>
          <h4 className="font-display text-[11px] font-bold text-[var(--umx-white)] uppercase tracking-wider mb-0.5">故障诊断占比 (BUG)</h4>
          <p className="font-body text-[10px] text-[var(--umx-text-dim)] leading-relaxed">
            系统中报告的机械结构及电子交互 Bug 数量为 <span className="text-[#ff6b6b] font-bold font-mono">{bugs}</span> 宗。
          </p>
        </div>
      </div>

      {/* Feature gauge */}
      <div className="flex items-center gap-4 border-r border-[var(--umx-line)] pr-4 last:border-none md:border-r">
        <div className="relative size-16 shrink-0">
          <svg className="size-full -rotate-90">
            <circle cx="32" cy="32" r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth="3.5" fill="transparent" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="var(--umx-acid)"
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={featOffset}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(218,252,8,0.25))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <span className="text-[12px] font-bold text-[var(--umx-acid)]">{featPercent}%</span>
            <span className="text-[6px] tracking-wider text-[var(--umx-text-dim)] uppercase">提案率</span>
          </div>
        </div>
        <div>
          <h4 className="font-display text-[11px] font-bold text-[var(--umx-white)] uppercase tracking-wider mb-0.5">先锋提案占比 (FEAT)</h4>
          <p className="font-body text-[10px] text-[var(--umx-text-dim)] leading-relaxed">
            收集的未来家居模块化功能提案及需求数量为 <span className="text-[var(--umx-acid)] font-bold font-mono">{features}</span> 宗。
          </p>
        </div>
      </div>

      {/* Process gauge */}
      <div className="flex flex-col justify-center gap-1.5 pr-2">
        <div className="flex justify-between items-baseline font-mono text-[9px]">
          <span className="text-[var(--umx-text-dim)] uppercase tracking-widest">已受理/开发中占比 (RESOLVING)</span>
          <span className="text-white font-bold">{resolved} / {total} ({resolvedPercent}%)</span>
        </div>
        <div className="h-1.5 w-full bg-[rgba(255,255,255,0.03)] border border-[var(--umx-line)] p-[1px]">
          <div
            className="h-full bg-gradient-to-r from-[#7201FF] to-[var(--umx-acid)] transition-all duration-500"
            style={{ width: `${resolvedPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[7px] font-mono text-[var(--umx-text-dim)] tracking-wider">
          <span>UMX HARDWARE INTERACT</span>
          <span>CYBERPUNK v1.1.2</span>
        </div>
      </div>
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
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen(!open);
        }}
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
                onClick={(e) => {
                  e.stopPropagation();
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
        <div className="fixed inset-0 z-20" onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
        }} />
      )}
    </div>
  );
}

/* ── Admin Note Inline Editor ──────────────────────────────────── */

function AdminNoteEditor({
  feedbackId,
  initialNote,
  onSave,
}: {
  feedbackId: string;
  initialNote: string;
  onSave: (id: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("feedback")
      .update({ admin_note: note, updated_at: new Date().toISOString() })
      .eq("id", feedbackId);
    setSaving(false);
    setEditing(false);
    if (!error) {
      onSave(feedbackId, note);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
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
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
      {attachments.slice(0, 3).map((att) => {
        const isImage = att.type.startsWith("image/");
        return (
          <a
            key={att.path}
            href={getPublicUrl(att.path)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
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
      {attachments.length > 3 && (
        <span className="inline-flex items-center px-1.5 py-1 font-mono text-[8px] text-[var(--umx-text-dim)] border border-dashed border-[var(--umx-line)]">
          +{attachments.length - 3} MORE
        </span>
      )}
    </div>
  );
}

/* ── Detail Drawer Slider ───────────────────────────────────────── */

function DetailDrawer({
  item,
  onClose,
  onStatusChange,
  onNoteSave,
}: {
  item: FeedbackRow;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onNoteSave: (id: string, note: string) => void;
}) {
  const [note, setNote] = useState(item.admin_note ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setNote(item.admin_note ?? "");
  }, [item]);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveNote = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("feedback")
      .update({ admin_note: note, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setSaving(false);
    if (!error) {
      onNoteSave(item.id, note);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("feedback")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setUpdating(false);
    if (!error) {
      onStatusChange(item.id, newStatus);
    }
  };

  const remainingDays = item.status === "rejected" ? daysUntilAutoDelete(item.updated_at) : null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex h-full w-[450px] max-w-full flex-col border-l border-[var(--umx-line)] bg-[var(--umx-bg-1)] shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[var(--umx-line)] px-6 py-5 bg-[var(--umx-bg-0)]">
          <div className="flex items-center gap-2">
            <UmxSymbol size={20} className="text-[var(--umx-acid)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--umx-white)] uppercase">DETAIL PANEL</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center border border-[var(--umx-line)] text-[var(--umx-text-dim)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)] transition-colors"
            style={{ borderRadius: "2px" }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 umx-scrollbar">
          {/* Header Stats */}
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: item.type === "bug" ? "#ff6b6b" : "var(--umx-acid)" }}
            >
              {item.type === "bug" ? <Bug className="size-3.5" /> : <Lightbulb className="size-3.5" />}
              {item.type === "bug" ? "BUG REPORT" : "FEATURE PROPOSAL"}
            </span>

            <StatusDropdown
              currentStatus={item.status}
              onSelect={handleStatusChange}
              disabled={updating}
            />
          </div>

          {/* User & Date info */}
          <div className="border border-[var(--umx-line)] bg-black/20 p-4 font-mono text-[10px] space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">USER EMAIL:</span>
              <span className="text-[var(--umx-silver)] select-all">{item.user_email || "Anonymous"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">FEEDBACK ID:</span>
              <span className="text-[var(--umx-text-dim)] select-all">{item.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">SUBMITTED ON:</span>
              <span className="text-[var(--umx-silver)]">{formatDate(item.created_at)}</span>
            </div>
            {remainingDays !== null && (
              <div className="flex justify-between text-[#ff6b6b] font-bold">
                <span>AUTO PURGE:</span>
                <span>{remainingDays} days remaining</span>
              </div>
            )}
          </div>

          {/* Feedback Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="font-display text-[11px] font-bold text-white uppercase tracking-wider">反馈诉求内容</h5>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 font-mono text-[9px] text-[var(--umx-text-dim)] hover:text-white transition-colors"
              >
                {copied ? <span className="text-[var(--umx-acid)]">COPIED</span> : <span>COPY TEXT</span>}
                <Copy className="size-3" />
              </button>
            </div>
            <div
              className="p-4 border border-[var(--umx-line)] bg-black/40 font-body text-xs leading-relaxed text-[var(--umx-silver)] whitespace-pre-wrap select-text"
              style={{ borderRadius: "2px" }}
            >
              {item.content}
            </div>
          </div>

          {/* Large Attachment Previews */}
          {item.attachments && item.attachments.length > 0 && (
            <div className="space-y-3">
              <h5 className="font-display text-[11px] font-bold text-white uppercase tracking-wider">附件清单预览 ({item.attachments.length})</h5>
              <div className="space-y-2.5">
                {item.attachments.map((att) => {
                  const isImage = att.type.startsWith("image/");
                  const publicUrl = getPublicUrl(att.path);
                  return (
                    <div
                      key={att.path}
                      className="border border-[var(--umx-line)] bg-black/20 p-2.5 flex flex-col gap-2"
                      style={{ borderRadius: "2px" }}
                    >
                      <div className="flex items-center justify-between font-mono text-[9px]">
                        <span className="truncate max-w-[200px] text-[var(--umx-silver)] font-bold">{att.name}</span>
                        <span className="text-[var(--umx-text-dim)]">{humanSize(att.size)}</span>
                      </div>

                      {isImage && (
                        <div className="relative overflow-hidden border border-[var(--umx-line)] bg-black/40" style={{ maxHeight: "200px" }}>
                          <img
                            src={publicUrl}
                            alt={att.name}
                            className="w-full h-auto object-contain max-h-[200px] transition-transform hover:scale-105 duration-300"
                          />
                        </div>
                      )}

                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 border border-[var(--umx-line)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)] py-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors"
                        style={{ borderRadius: "2px" }}
                      >
                        <Download className="size-3" />
                        下载原始附件
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin Note Section */}
          <div className="space-y-2 border-t border-[var(--umx-line)] pt-5">
            <h5 className="font-display text-[11px] font-bold text-white uppercase tracking-wider">管理员备注管理</h5>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="在这里输入内部备注或技术分析结论..."
              rows={4}
              className="w-full p-3 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] font-body text-xs text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] transition-colors placeholder:text-[var(--umx-text-dim)] resize-none"
              style={{ borderRadius: "2px" }}
            />
            <button
              onClick={handleSaveNote}
              disabled={saving || note === item.admin_note}
              className="flex w-full items-center justify-center gap-1.5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-black bg-[var(--umx-acid)] hover:bg-white disabled:bg-[var(--umx-line)] disabled:text-[var(--umx-text-dim)] transition-all font-bold"
              style={{ borderRadius: "2px", cursor: saving || note === item.admin_note ? "not-allowed" : "pointer" }}
            >
              {saving ? "SAVING..." : "SAVE ADMIN NOTE"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Feedback Table Row ────────────────────────────────────────── */

function FeedbackTableRow({
  item,
  isSelected,
  onSelectToggle,
  onStatusChange,
  onDelete,
  onRowClick,
  onNoteSave,
}: {
  item: FeedbackRow;
  isSelected: boolean;
  onSelectToggle: (id: string) => void;
  onStatusChange: (id: string, newStatus: string) => void;
  onDelete: (id: string) => void;
  onRowClick: (item: FeedbackRow) => void;
  onNoteSave: (id: string, note: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("feedback")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setUpdating(false);
    if (!error) onStatusChange(item.id, newStatus);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    const attachments = item.attachments ?? [];
    if (attachments.length > 0) {
      const paths = attachments.map((a) => a.path);
      await supabase.storage.from("feedback-attachments").remove(paths);
    }
    const { error } = await supabase.from("feedback").delete().eq("id", item.id);
    setDeleting(false);
    if (!error) onDelete(item.id);
    setConfirmDelete(false);
  };

  const remainingDays = item.status === "rejected" ? daysUntilAutoDelete(item.updated_at) : null;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      onClick={() => onRowClick(item)}
      className="border-b border-[var(--umx-line)] transition-colors hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
    >
      {/* Selection checkbox */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onSelectToggle(item.id)}
          className="flex size-5 items-center justify-center text-[var(--umx-text-dim)] hover:text-[var(--umx-acid)] transition-colors"
        >
          {isSelected ? (
            <CheckSquare className="size-4 text-[var(--umx-acid)]" />
          ) : (
            <Square className="size-4 opacity-50" />
          )}
        </button>
      </td>

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
        <span className="font-mono text-[11px] text-[var(--umx-silver)] select-all">
          {item.user_email || item.user_id.slice(0, 8) + "..."}
        </span>
      </td>

      {/* Content */}
      <td className="max-w-xs px-4 py-3">
        <p className="line-clamp-2 font-body text-xs leading-relaxed text-[var(--umx-silver)] select-text">
          {item.content}
        </p>
        <AttachmentChips attachments={item.attachments} />
      </td>

      {/* Status + countdown */}
      <td className="px-4 py-3">
        <StatusDropdown
          currentStatus={item.status}
          onSelect={handleStatusChange}
          disabled={updating}
        />
        {remainingDays !== null && (
          <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-[#ff6b6b]">
            <Timer className="size-2.5" />
            <span>{remainingDays}天后自动删除</span>
          </div>
        )}
      </td>

      {/* Admin Note */}
      <td className="px-4 py-3">
        <AdminNoteEditor feedbackId={item.id} initialNote={item.admin_note ?? ""} onSave={onNoteSave} />
      </td>

      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1 text-[var(--umx-text-dim)]">
          <Clock className="size-3" />
          <span className="font-mono text-[10px]">{formatDate(item.created_at)}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="font-mono text-[9px] uppercase tracking-wider text-[#ff6b6b] transition-colors hover:text-white"
            >
              {deleting ? "..." : "确认"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)] transition-colors hover:text-white"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex size-6 items-center justify-center text-[var(--umx-text-dim)] transition-colors hover:text-[#ff6b6b]"
            title="删除"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </td>
    </motion.tr>
  );
}

/* ── Loading ───────────────────────────────────────────────────── */

function UmxLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--umx-black)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.16em", color: "var(--umx-text-dim)", textTransform: "uppercase" }}>
        LOADING SYSTEM CORE...
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
        403 — 您不是系统管理员 白名单之外已拦截访问
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

  /* New advanced filters & controls */
  const [filterHasAttachments, setFilterHasAttachments] = useState(false);
  const [filterHasNotes, setFilterHasNotes] = useState(false);
  const [sortByDate, setSortByDate] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedbackRow | null>(null);

  /* Dev tools state */
  const [devOpen, setDevOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

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
    if (selectedItem?.id === id) {
      setSelectedItem(prev => prev ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : null);
    }
  };

  const handleNoteSave = (id: string, note: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, admin_note: note, updated_at: new Date().toISOString() } : item,
      ),
    );
    if (selectedItem?.id === id) {
      setSelectedItem(prev => prev ? { ...prev, admin_note: note, updated_at: new Date().toISOString() } : null);
    }
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  /* Multi selection helpers */
  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filters output
  const filtered = items.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterHasAttachments && (!item.attachments || item.attachments.length === 0)) return false;
    if (filterHasNotes && (!item.admin_note || item.admin_note.trim() === "")) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.content.toLowerCase().includes(q) ||
        (item.user_email?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  }).sort((a, b) => {
    const tA = new Date(a.created_at).getTime();
    const tB = new Date(b.created_at).getTime();
    return sortByDate === "desc" ? tB - tA : tA - tB;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((item) => item.id));
    }
  };

  /* Batch change handlers */
  const handleBatchStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase
      .from("feedback")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in("id", selectedIds);
    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          selectedIds.includes(item.id)
            ? { ...item, status: newStatus, updated_at: new Date().toISOString() }
            : item
        )
      );
      setSelectedIds([]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    
    // Fetch elements to drop storage files first
    const itemsToDelete = items.filter(item => selectedIds.includes(item.id));
    for (const item of itemsToDelete) {
      const attachments = item.attachments ?? [];
      if (attachments.length > 0) {
        const paths = attachments.map((a) => a.path);
        await supabase.storage.from("feedback-attachments").remove(paths);
      }
    }

    const { error } = await supabase.from("feedback").delete().in("id", selectedIds);
    if (!error) {
      setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      setConfirmBatchDelete(false);
    }
  };

  /* Client-side Exporters */
  const exportCSV = () => {
    const headers = ["ID", "Type", "User Email", "Content", "Status", "Admin Note", "Created At"];
    const rows = filtered.map((item) => [
      item.id,
      item.type,
      item.user_email || "",
      item.content.replace(/"/g, '""'),
      item.status,
      item.admin_note?.replace(/"/g, '""') || "",
      item.created_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\ufeff"
      + [headers.join(","), ...rows.map(r => r.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `umx_feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filtered, null, 2)
    )}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `umx_feedback_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* Mock Data Generator Helper */
  const generateMockData = async () => {
    setGenerating(true);
    try {
      const newItems = UMX_MOCK_FEEDBACKS.map((item) => ({
        ...item,
        user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        attachments: []
      }));
      const { data, error } = await supabase.from("feedback").insert(newItems).select();
      if (!error && data) {
        setItems((prev) => [...(data as FeedbackRow[]), ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)] pb-24">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            · ADMIN DASHBOARD
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Dev Mode toggle button */}
          <button
            onClick={() => setDevOpen(!devOpen)}
            className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] uppercase tracking-wider border transition-all ${
              devOpen
                ? "border-[var(--umx-acid)] text-[var(--umx-acid)] bg-[var(--umx-acid)]/5"
                : "border-[var(--umx-line)] text-[var(--umx-text-dim)] hover:text-white"
            }`}
            style={{ borderRadius: "2px" }}
          >
            <Sparkles className="size-3 animate-pulse" />
            DEV TOOLS
          </button>
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

        {/* Developer Tools Drawer */}
        <AnimatePresence>
          {devOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6 border border-dashed border-[var(--umx-acid)]/30 bg-black/40 p-4"
              style={{ borderRadius: "2px" }}
            >
              <div className="flex items-center justify-between font-mono text-[10px] mb-3">
                <span className="text-[var(--umx-acid)] font-bold flex items-center gap-1.5">
                  <Info className="size-3.5" />
                  开发与调试辅助工具面板
                </span>
                <span className="text-[var(--umx-text-dim)]">用于快速加载 UMX 品牌高拟真反馈数据</span>
              </div>
              <button
                onClick={generateMockData}
                disabled={generating}
                className="flex items-center gap-2 border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] font-mono text-[10px] px-4 py-2 uppercase tracking-widest font-bold transition-all disabled:opacity-50"
                style={{ borderRadius: "2px", cursor: generating ? "wait" : "pointer" }}
              >
                {generating ? "INSERTING..." : "一键导入 UMX 先锋产品调试反馈"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visual Charts Analytics */}
        {!loading && <AnalyticsDashboard items={items} />}

        {/* Stats */}
        {!loading && <StatsBar items={items} />}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3 bg-[var(--umx-bg-1)] border border-[var(--umx-line)] p-4" style={{ borderRadius: "2px" }}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索内容或邮箱..."
              className="w-56 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] py-2 pl-9 pr-3 font-body text-xs text-[var(--umx-white)] outline-none transition-colors placeholder:text-[var(--umx-text-dim)] focus:border-[var(--umx-acid)]"
              style={{ borderRadius: "2px" }}
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
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
            className="appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
            style={{ borderRadius: "2px" }}
          >
            <option value="all">ALL STATUS</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Sort By Date */}
          <button
            onClick={() => setSortByDate(prev => prev === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white hover:border-white transition-colors"
            style={{ borderRadius: "2px" }}
          >
            <Clock className="size-3" />
            SORT: {sortByDate === "desc" ? "LATEST" : "OLDEST"}
          </button>

          {/* Filter: attachments */}
          <button
            onClick={() => setFilterHasAttachments(!filterHasAttachments)}
            className={`flex items-center gap-1.5 px-3 py-2 border font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
              filterHasAttachments
                ? "border-[var(--umx-acid)] text-[var(--umx-acid)] bg-[var(--umx-acid)]/5"
                : "border-[var(--umx-line)] bg-[var(--umx-bg-2)] text-[var(--umx-text-dim)] hover:text-white"
            }`}
            style={{ borderRadius: "2px" }}
          >
            <Paperclip className="size-3" />
            HAS ATTACHMENTS
          </button>

          {/* Filter: admin notes */}
          <button
            onClick={() => setFilterHasNotes(!filterHasNotes)}
            className={`flex items-center gap-1.5 px-3 py-2 border font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
              filterHasNotes
                ? "border-[var(--umx-acid)] text-[var(--umx-acid)] bg-[var(--umx-acid)]/5"
                : "border-[var(--umx-line)] bg-[var(--umx-bg-2)] text-[var(--umx-text-dim)] hover:text-white"
            }`}
            style={{ borderRadius: "2px" }}
          >
            <MessageSquare className="size-3" />
            HAS ADMIN NOTES
          </button>

          {/* Exporter Buttons */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1 border border-[var(--umx-line)] hover:border-white px-2.5 py-2 font-mono text-[9px] tracking-wider text-[var(--umx-silver)] uppercase transition-colors"
              style={{ borderRadius: "2px" }}
            >
              <DownloadCloud className="size-3" />
              CSV
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-1 border border-[var(--umx-line)] hover:border-white px-2.5 py-2 font-mono text-[9px] tracking-wider text-[var(--umx-silver)] uppercase transition-colors"
              style={{ borderRadius: "2px" }}
            >
              <FileJson className="size-3" />
              JSON
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto border border-[var(--umx-line)]" style={{ borderRadius: "2px" }}>
          {loading ? (
            <div className="flex justify-center py-20">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
                LOADING FEEDBACK RECORDS...
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
                <tr className="border-b border-[var(--umx-line)] bg-[var(--umx-bg-1)] select-none">
                  {/* Select All Checkbox */}
                  <th className="w-10 px-4 py-3 text-left font-mono">
                    <button
                      onClick={toggleSelectAll}
                      className="flex size-5 items-center justify-center text-[var(--umx-text-dim)] hover:text-white transition-colors"
                    >
                      {selectedIds.length === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="size-4 text-[var(--umx-acid)]" />
                      ) : (
                        <Square className="size-4 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">TYPE</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">USER</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">CONTENT</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">STATUS</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">NOTE</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">DATE</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((item) => (
                    <FeedbackTableRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      onSelectToggle={handleSelectToggle}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onRowClick={setSelectedItem}
                      onNoteSave={handleNoteSave}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Slide-over Detail Drawer Panel */}
      <AnimatePresence>
        {selectedItem && (
          <DetailDrawer
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onStatusChange={handleStatusChange}
            onNoteSave={handleNoteSave}
          />
        )}
      </AnimatePresence>

      {/* Floating Bulk Action Deck */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 50, opacity: 0, x: "-50%" }}
            className="fixed bottom-8 left-1/2 z-40 flex items-center gap-4 border border-[var(--umx-acid)] bg-black/95 px-6 py-4 shadow-xl shadow-black/80"
            style={{ borderRadius: "2px" }}
          >
            <div className="flex items-center gap-2 border-r border-[var(--umx-line)] pr-4 font-mono text-[10px]">
              <span className="text-[var(--umx-acid)] font-bold">🗳️ SELECTED:</span>
              <span className="text-white font-bold">{selectedIds.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-[var(--umx-text-dim)] uppercase tracking-wider">批量状态更新:</span>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleBatchStatusChange(s.value)}
                    className="px-2 py-1 border border-transparent hover:border-white font-mono text-[9px] uppercase tracking-wider text-white transition-colors"
                    style={{ background: s.bg, color: s.color, borderRadius: "2px" }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-[var(--umx-line)] pl-4">
              {confirmBatchDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleBatchDelete}
                    className="font-mono text-[9px] font-bold text-[#ff6b6b] hover:text-white uppercase transition-colors"
                  >
                    确认删除
                  </button>
                  <button
                    onClick={() => setConfirmBatchDelete(false)}
                    className="font-mono text-[9px] text-[var(--umx-text-dim)] hover:text-white uppercase transition-colors"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBatchDelete(true)}
                  className="flex items-center gap-1 font-mono text-[9px] text-[#ff6b6b] hover:text-white uppercase transition-colors"
                >
                  <Trash2 className="size-3" />
                  批量删除
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedIds([])}
              className="flex size-5 items-center justify-center border border-[var(--umx-line)] hover:border-white text-[var(--umx-text-dim)] hover:text-white transition-colors"
              style={{ borderRadius: "2px" }}
            >
              <X className="size-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
