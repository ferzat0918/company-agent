"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bug, Lightbulb, Clock, Paperclip, Search,
  FileText, FileSpreadsheet, Music, Film, Image as ImageIcon,
  Download, ChevronDown, Shield, MessageSquare, Save, X, Trash2, Timer,
  Copy, Sparkles, DownloadCloud, FileJson, CheckSquare, Square, Info,
  Users, UserCheck, ShieldAlert, MapPin, Building,
  Terminal, Plus, RefreshCw, MessageSquareCode
} from "lucide-react";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { supabase, supabaseAnonKey } from "@/lib/supabase";
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

type UserViewRow = {
  user_id: string;
  email: string | null;
  registered_at: string;
  dept: string;
  role: string;
  region: string;
};

const DEPTS = ["研发部", "产品设计部", "市场运营部", "客户成功部", "财务部", "未分配"];
const ROLES = ["系统管理员", "部门主管", "普通用户"];
const REGIONS = ["华东地区", "华南地区", "华北地区", "海外地区", "未分配"];

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

/* ── User Edit Drawer Slider ─────────────────────────────────────── */

function UserEditDrawer({
  item,
  onClose,
  onSave,
}: {
  item: UserViewRow;
  onClose: () => void;
  onSave: (updated: UserViewRow) => void;
}) {
  const [dept, setDept] = useState(item.dept || "未分配");
  const [role, setRole] = useState(item.role || "普通用户");
  const [region, setRegion] = useState(item.region || "未分配");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDept(item.dept || "未分配");
    setRole(item.role || "普通用户");
    setRegion(item.region || "未分配");
  }, [item]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: item.user_id,
        dept,
        role,
        region,
      });
    setSaving(false);
    if (!error) {
      onSave({
        ...item,
        dept,
        role,
        region,
      });
      onClose();
    } else {
      alert("更新失败，请重试！");
    }
  };

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
            <UserCheck size={20} className="text-[var(--umx-acid)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--umx-white)] uppercase">EDIT USER PROFILE</span>
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
          {/* User ID & Email info */}
          <div className="border border-[var(--umx-line)] bg-black/20 p-4 font-mono text-[10px] space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">EMAIL ADDRESS:</span>
              <span className="text-[var(--umx-silver)] select-all">{item.email || "Anonymous"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">USER ID:</span>
              <span className="text-[var(--umx-text-dim)] select-all">{item.user_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">REGISTERED AT:</span>
              <span className="text-[var(--umx-silver)]">{formatDate(item.registered_at)}</span>
            </div>
          </div>

          {/* Department Select */}
          <div className="space-y-2">
            <label className="font-display text-[11px] font-bold text-white uppercase tracking-wider block">分配部门 (DEPARTMENT)</label>
            <div className="relative">
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="w-full appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
                style={{ borderRadius: "2px" }}
              >
                {DEPTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Role Select */}
          <div className="space-y-2">
            <label className="font-display text-[11px] font-bold text-white uppercase tracking-wider block">分配角色 (ROLE)</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
                style={{ borderRadius: "2px" }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Region Select */}
          <div className="space-y-2">
            <label className="font-display text-[11px] font-bold text-white uppercase tracking-wider block">所属地区 (REGION)</label>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
                style={{ borderRadius: "2px" }}
              >
                {REGIONS.map((reg) => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[var(--umx-line)] flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-[var(--umx-line)] hover:border-white font-mono text-[10px] uppercase tracking-widest text-[var(--umx-silver)] transition-all font-bold"
              style={{ borderRadius: "2px" }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 font-mono text-[10px] uppercase tracking-widest text-black bg-[var(--umx-acid)] hover:bg-white disabled:bg-[var(--umx-line)] disabled:text-[var(--umx-text-dim)] transition-all font-bold"
              style={{ borderRadius: "2px", cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "SAVING..." : "保存变更"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── User Stats Visualizer Dashboard ────────────────────────────── */

function UserStatsDashboard({ items }: { items: UserViewRow[] }) {
  const total = items.length;
  const adminCount = items.filter((i) => i.role === "系统管理员").length;
  const deptAssigned = items.filter((i) => i.dept && i.dept !== "未分配").length;
  const assignedPercent = total > 0 ? Math.round((deptAssigned / total) * 100) : 0;

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
      {/* Total Users */}
      <div className="flex items-center gap-4 border-r border-[var(--umx-line)] pr-4 last:border-none md:border-r font-mono">
        <div className="flex size-12 items-center justify-center bg-white/5 border border-[var(--umx-line)] shrink-0">
          <Users className="size-6 text-[var(--umx-acid)]" />
        </div>
        <div>
          <h4 className="font-display text-[11px] font-bold text-[var(--umx-white)] uppercase tracking-wider mb-0.5">总注册用户数 (TOTAL USERS)</h4>
          <p className="font-mono text-lg font-bold text-white mb-0">
            {total} <span className="text-[10px] font-normal text-[var(--umx-text-dim)] uppercase tracking-widest">ACCOUNTS</span>
          </p>
        </div>
      </div>

      {/* Role Counts */}
      <div className="flex items-center gap-4 border-r border-[var(--umx-line)] pr-4 last:border-none md:border-r font-mono">
        <div className="flex size-12 items-center justify-center bg-white/5 border border-[var(--umx-line)] shrink-0">
          <ShieldAlert className="size-6 text-[#7201FF]" />
        </div>
        <div>
          <h4 className="font-display text-[11px] font-bold text-[var(--umx-white)] uppercase tracking-wider mb-0.5">特权管理员数 (PRIVILEGES)</h4>
          <p className="font-mono text-lg font-bold text-white mb-0">
            {adminCount} <span className="text-[10px] font-normal text-[var(--umx-text-dim)] uppercase tracking-widest">ADMINISTRATORS</span>
          </p>
        </div>
      </div>

      {/* Assignment rate */}
      <div className="flex flex-col justify-center gap-1.5 pr-2">
        <div className="flex justify-between items-baseline font-mono text-[9px]">
          <span className="text-[var(--umx-text-dim)] uppercase tracking-widest">组织部门分配率 (DEPT ASSIGNED)</span>
          <span className="text-white font-bold">{deptAssigned} / {total} ({assignedPercent}%)</span>
        </div>
        <div className="h-1.5 w-full bg-[rgba(255,255,255,0.03)] border border-[var(--umx-line)] p-[1px]">
          <div
            className="h-full bg-gradient-to-r from-[#7201FF] to-[var(--umx-acid)] transition-all duration-500"
            style={{ width: `${assignedPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[7px] font-mono text-[var(--umx-text-dim)] tracking-wider">
          <span>UMX ACCESS & PROFILE SYSTEM</span>
          <span>CYBERPUNK v1.1.2</span>
        </div>
      </div>
    </div>
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

  /* User management state */
  const [activeTab, setActiveTab] = useState<"feedback" | "users" | "wechat">("feedback");
  const [usersData, setUsersData] = useState<UserViewRow[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userFilterDept, setUserFilterDept] = useState<string>("all");
  const [userFilterRole, setUserFilterRole] = useState<string>("all");
  const [userSortByDate, setUserSortByDate] = useState<"desc" | "asc">("desc");
  const [selectedUser, setSelectedUser] = useState<UserViewRow | null>(null);

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

  const fetchUsers = useCallback(async () => {
    setUserLoading(true);
    const { data, error } = await supabase
      .from("admin_user_view")
      .select("*");
    if (!error && data) setUsersData(data as UserViewRow[]);
    setUserLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [fetchData, fetchUsers]);

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

  // User filters output
  const filteredUsers = usersData.filter((userRow) => {
    if (userFilterDept !== "all" && userRow.dept !== userFilterDept) return false;
    if (userFilterRole !== "all" && userRow.role !== userFilterRole) return false;

    if (userSearchQuery) {
      const q = userSearchQuery.toLowerCase();
      return (
        (userRow.email?.toLowerCase().includes(q) ?? false) ||
        userRow.user_id.toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    const tA = new Date(a.registered_at).getTime();
    const tB = new Date(b.registered_at).getTime();
    return userSortByDate === "desc" ? tB - tA : tA - tB;
  });

  const exportUsersCSV = () => {
    const headers = ["User ID", "Email", "Department", "Role", "Region", "Registered At"];
    const rows = filteredUsers.map((u) => [
      u.user_id,
      u.email || "",
      u.dept,
      u.role,
      u.region,
      u.registered_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\ufeff"
      + [headers.join(","), ...rows.map(r => r.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `umx_users_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportUsersJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredUsers, null, 2)
    )}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `umx_users_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUserSave = (updated: UserViewRow) => {
    setUsersData((prev) =>
      prev.map((u) => (u.user_id === updated.user_id ? updated : u))
    );
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
        {/* Navigation Tabs */}
        <div className="mb-8 flex border-b border-[var(--umx-line)]">
          <button
            onClick={() => setActiveTab("feedback")}
            className={`relative pb-4 pr-8 font-display text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
              activeTab === "feedback" ? "text-white" : "text-[var(--umx-text-dim)] hover:text-white"
            }`}
          >
            <span>FEEDBACK MANAGEMENT</span>
            {activeTab === "feedback" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-[-1px] left-0 h-[2px] bg-[var(--umx-acid)]"
                style={{ width: "calc(100% - 32px)" }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`relative pb-4 pr-8 font-display text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
              activeTab === "users" ? "text-white" : "text-[var(--umx-text-dim)] hover:text-white"
            }`}
          >
            <span>USER PROFILE MANAGEMENT</span>
            {activeTab === "users" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-[-1px] left-0 h-[2px] bg-[var(--umx-acid)]"
                style={{ width: "calc(100% - 32px)" }}
              />
            )}
          </button>
        </div>

        {activeTab === "feedback" && (
          <>
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
          </>
        )}

        {activeTab === "users" && (
          <>
            {/* User Visual Stats */}
            {!userLoading && <UserStatsDashboard items={usersData} />}

            {/* User Filters */}
            <div className="mt-6 flex flex-wrap items-center gap-3 bg-[var(--umx-bg-1)] border border-[var(--umx-line)] p-4" style={{ borderRadius: "2px" }}>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
                <input
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="搜索用户邮箱或 ID..."
                  className="w-56 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] py-2 pl-9 pr-3 font-body text-xs text-[var(--umx-white)] outline-none transition-colors placeholder:text-[var(--umx-text-dim)] focus:border-[var(--umx-acid)]"
                  style={{ borderRadius: "2px" }}
                />
              </div>

              {/* Department filter */}
              <select
                value={userFilterDept}
                onChange={(e) => setUserFilterDept(e.target.value)}
                className="appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
                style={{ borderRadius: "2px" }}
              >
                <option value="all">ALL DEPARTMENTS</option>
                {DEPTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* Role filter */}
              <select
                value={userFilterRole}
                onChange={(e) => setUserFilterRole(e.target.value)}
                className="appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer"
                style={{ borderRadius: "2px" }}
              >
                <option value="all">ALL ROLES</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* Sort By Date */}
              <button
                onClick={() => setUserSortByDate(prev => prev === "desc" ? "asc" : "desc")}
                className="flex items-center gap-1.5 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white hover:border-white transition-colors"
                style={{ borderRadius: "2px" }}
              >
                <Clock className="size-3" />
                SORT: {userSortByDate === "desc" ? "LATEST REGISTERED" : "OLDEST REGISTERED"}
              </button>

              {/* Exporter Buttons */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={exportUsersCSV}
                  className="flex items-center gap-1 border border-[var(--umx-line)] hover:border-white px-2.5 py-2 font-mono text-[9px] tracking-wider text-[var(--umx-silver)] uppercase transition-colors"
                  style={{ borderRadius: "2px" }}
                >
                  <DownloadCloud className="size-3" />
                  CSV
                </button>
                <button
                  onClick={exportUsersJSON}
                  className="flex items-center gap-1 border border-[var(--umx-line)] hover:border-white px-2.5 py-2 font-mono text-[9px] tracking-wider text-[var(--umx-silver)] uppercase transition-colors"
                  style={{ borderRadius: "2px" }}
                >
                  <FileJson className="size-3" />
                  JSON
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="mt-6 overflow-x-auto border border-[var(--umx-line)]" style={{ borderRadius: "2px" }}>
              {userLoading ? (
                <div className="flex justify-center py-20">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
                    LOADING USER RECORDS...
                  </span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-3 size-8 text-[var(--umx-text-dim)]" />
                  <p className="font-mono text-[11px] text-[var(--umx-text-dim)]">
                    没有匹配的用户记录
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--umx-line)] bg-[var(--umx-bg-1)] select-none">
                      <th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">EMAIL ADDRESS</th>
                      <th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">USER ID</th>
                      <th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">DEPARTMENT</th>
                      <th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">ROLE</th>
                      <th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">REGION</th>
                      <th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">REGISTERED DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredUsers.map((userRow) => (
                        <motion.tr
                          key={userRow.user_id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedUser(userRow)}
                          className="border-b border-[var(--umx-line)] transition-colors hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                        >
                          <td className="px-6 py-4 font-mono text-[11px] text-white font-bold select-all">
                            {userRow.email || "Anonymous"}
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-[var(--umx-text-dim)] select-all">
                            {userRow.user_id}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider border border-[var(--umx-line)] text-white" style={{ background: "rgba(255,255,255,0.02)", borderRadius: "2px" }}>
                              <Building className="size-2.5 text-[var(--umx-silver)]" />
                              {userRow.dept || "未分配"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider border text-[var(--umx-acid)]" style={{ background: "rgba(218,252,8,0.03)", borderColor: "rgba(218,252,8,0.2)", borderRadius: "2px" }}>
                              <UserCheck className="size-2.5 text-[var(--umx-acid)]" />
                              {userRow.role || "普通用户"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider border text-[#7201FF]" style={{ background: "rgba(114,1,255,0.03)", borderColor: "rgba(114,1,255,0.2)", borderRadius: "2px" }}>
                              <MapPin className="size-2.5 text-[#7201FF]" />
                              {userRow.region || "未分配"}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-[var(--umx-text-dim)]">
                            {formatDate(userRow.registered_at)}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </>
        )
      }
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

      {/* Slide-over User Profile Edit Drawer Panel */}
      <AnimatePresence>
        {selectedUser && (
          <UserEditDrawer
            item={selectedUser}
            onClose={() => setSelectedUser(null)}
            onSave={handleUserSave}
          />
        )}
      </AnimatePresence>

      {/* Floating Bulk Action Deck */}
      <AnimatePresence>
        {selectedIds.length > 0 && activeTab === "feedback" && (
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
                    onClick={() => handleBatchDelete()}
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

/* ── WeChat RPA Management Dashboard ────────────────────────────── */

function WeChatManagementView() {
  const [status, setStatus] = useState<WeChatStatusRow | null>(null);
  const [settings, setSettings] = useState<WeChatSettingsRow | null>(null);
  const [history, setHistory] = useState<WeChatHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [listenChatsList, setListenChatsList] = useState<string[]>([]);
  const [isBotActive, setIsBotActive] = useState(true);
  const [listeningMode, setListeningMode] = useState<'global' | 'whitelist'>('global');
  
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);

  // New settings configurations
  const [systemPrompt, setSystemPrompt] = useState("你是一个温暖专业的AI助理。请用简洁、亲和的语调进行微信回复，多使用 Emoji。");
  const [replyDelay, setReplyDelay] = useState(1);
  const [groupAtOnly, setGroupAtOnly] = useState(true);
  const [filePushEnabled, setFilePushEnabled] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSuccess, setRulesSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isProcessRunning, setIsProcessRunning] = useState(false);

  const fetchWeChatData = useCallback(async () => {
    try {
      const { data: settingsData } = await supabase
        .from("wechat_settings")
        .select("*")
        .eq("id", "default")
        .single();
      
      if (settingsData) {
        setSettings(settingsData);
        setIsBotActive(settingsData.is_active);
        setSystemPrompt(settingsData.system_prompt || "你是一个温暖专业的AI助理。请用简洁、亲和的语调进行微信回复，多使用 Emoji。");
        setReplyDelay(settingsData.reply_delay ?? 1);
        setGroupAtOnly(settingsData.group_at_only ?? true);
        setFilePushEnabled(settingsData.file_push_enabled ?? true);
        
        // Read explicit listen_mode from database, default to 'whitelist' for safety
        const dbMode = (settingsData.listen_mode || 'whitelist') as 'global' | 'whitelist';
        setListeningMode(dbMode);

        const listStr = settingsData.listen_chats || "";
        if (listStr.trim()) {
          const arr = listStr.split(",").map((x: string) => x.trim()).filter(Boolean);
          setListenChatsList(arr);
        } else {
          setListenChatsList([]);
        }
      }

      const { data: statusData } = await supabase
        .from("wechat_status")
        .select("*")
        .eq("id", "default")
        .single();
      
      if (statusData) {
        setStatus(statusData);
      }

      const { data: historyData } = await supabase
        .from("wechat_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (historyData) {
        setHistory(historyData as WeChatHistoryRow[]);
      }

      // Fetch actual host process running state
      try {
        const resp = await fetch("/api/rpa");
        if (resp.ok) {
          const data = await resp.json();
          setIsProcessRunning(data.isRunning);
        }
      } catch (err) {
        console.error("Failed to check RPA process status:", err);
      }
    } catch (err) {
      console.error("Error fetching WeChat RPA metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeChatData();
    const interval = setInterval(() => {
      fetchWeChatData();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchWeChatData]);

  const handleSaveSettings = async (updatedActive: boolean, updatedList: string[]) => {
    setSavingSettings(true);
    setSaveError(null);
    const chatsStr = updatedList.join(",");
    try {
      const resp = await fetch("/rest/v1/wechat_settings?id=eq.default", {
        method: "PATCH",
        headers: {
          "apikey": supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          is_active: updatedActive,
          listen_chats: chatsStr,
          listen_mode: listeningMode,
          updated_at: new Date().toISOString()
        })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      setListenChatsList(updatedList);
      setIsBotActive(updatedActive);
      fetchWeChatData();
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setSaveError(err.message || JSON.stringify(err));
    }
    setSavingSettings(false);
  };

  const handleToggleListeningMode = async (mode: 'global' | 'whitelist') => {
    setSavingSettings(true);
    setSaveError(null);
    
    // Preserve the whitelist contacts when switching to global, so they aren't lost!
    // If switching to whitelist mode and the list is empty, seed it with "文件传输助手"
    let newList = [...listenChatsList];
    if (mode === 'whitelist' && newList.length === 0) {
      newList = ["文件传输助手"];
    }

    const chatsStr = newList.join(",");
    try {
      const resp = await fetch("/rest/v1/wechat_settings?id=eq.default", {
        method: "PATCH",
        headers: {
          "apikey": supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          listen_mode: mode,
          listen_chats: chatsStr,
          updated_at: new Date().toISOString()
        })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      setListenChatsList(newList);
      setListeningMode(mode);
      fetchWeChatData();
    } catch (err: any) {
      console.error("Failed to toggle listening mode:", err);
      setSaveError(err.message || JSON.stringify(err));
    }
    setSavingSettings(false);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    setRulesSuccess(false);
    setSaveError(null);
    try {
      const resp = await fetch("/rest/v1/wechat_settings?id=eq.default", {
        method: "PATCH",
        headers: {
          "apikey": supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          reply_delay: replyDelay,
          group_at_only: groupAtOnly,
          file_push_enabled: filePushEnabled,
          updated_at: new Date().toISOString()
        })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      setRulesSuccess(true);
      setSaveError(null);
      setTimeout(() => setRulesSuccess(false), 3000);
      fetchWeChatData();
    } catch (err: any) {
      console.error("Failed to save rules:", err);
      setSaveError(err.message || JSON.stringify(err));
    }
    setSavingRules(false);
  };

  const handleAddChat = () => {
    const trimmed = newChatName.trim();
    if (trimmed && !listenChatsList.includes(trimmed)) {
      const newList = [...listenChatsList, trimmed];
      handleSaveSettings(isBotActive, newList);
      setNewChatName("");
    }
  };

  const handleRemoveChat = (chatName: string) => {
    const newList = listenChatsList.filter(c => c !== chatName);
    handleSaveSettings(isBotActive, newList);
  };

  const handleToggleBot = () => {
    const nextState = !isBotActive;
    handleSaveSettings(nextState, listenChatsList);
  };

  const handleRpaControl = async (action: "start" | "stop") => {
    setControlLoading(true);
    setControlError(null);
    try {
      const resp = await fetch("/api/rpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setControlError(data.error || "操作失败");
      } else {
        setTimeout(() => fetchWeChatData(), 1500);
      }
    } catch (err: any) {
      setControlError(err.message || "请求异常");
    } finally {
      setControlLoading(false);
    }
  };

  const formatElapsed = (sec: number) => {
    return `${sec.toFixed(1)}s`;
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("zh-CN", { hour12: false });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
          CONNECTING TO WECHAT RPA TELEMETRY DATABASE...
        </span>
      </div>
    );
  }

  const isHeartbeatAlive = () => {
    if (!status?.last_heartbeat) return false;
    const last = new Date(status.last_heartbeat).getTime();
    const now = Date.now();
    return (now - last) < 20000;
  };

  const isOnline = status?.client_status === "online" && isHeartbeatAlive();

  // Calculated dynamic metrics
  const totalReplies = history.length;
  const successReplies = history.filter(h => h.status === "success").length;
  const successRate = totalReplies > 0 ? Math.round((successReplies / totalReplies) * 100) : 100;
  
  const processedReplies = history.filter(h => h.elapsed_time > 0);
  const avgThinkingTime = processedReplies.length > 0
    ? (processedReplies.reduce((sum, h) => sum + h.elapsed_time, 0) / processedReplies.length)
    : 0;
  
  const hourCounts = Array(24).fill(0);
  history.forEach(h => {
    try {
      const hr = new Date(h.created_at).getHours();
      hourCounts[hr]++;
    } catch (err) {
      console.warn(err);
    }
  });
  let peakHour = 0;
  let maxCount = 0;
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] > maxCount) {
      maxCount = hourCounts[i];
      peakHour = i;
    }
  }
  const activeWindowStr = maxCount > 0 ? `${String(peakHour).padStart(2, "0")}:00 - ${String((peakHour + 1) % 24).padStart(2, "0")}:00` : "暂无数据";

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Connection Status Card */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Daemon Connection</span>
              {isOnline ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--umx-acid)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--umx-acid)]"></span>
                </span>
              ) : (
                <span className="inline-flex rounded-full h-2 w-2 bg-neutral-600"></span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
                {isOnline ? "ONLINE" : "OFFLINE"}
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
              {isOnline ? `心跳正常 · 最后活动: ${formatTime(status?.last_heartbeat || "")}` : "未检测到本地 RPA 进程心跳"}
            </p>
          </div>
          
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50 space-y-2">
            {isProcessRunning || isOnline ? (
              <button
                onClick={() => handleRpaControl("stop")}
                disabled={controlLoading}
                className="w-full font-mono text-[9px] text-white hover:text-black uppercase text-center bg-red-600/20 hover:bg-red-500 border border-red-500/30 py-1.5 transition-all"
                style={{ borderRadius: "2px" }}
              >
                {controlLoading ? "PROCESSING..." : "停止托管进程 (STOP)"}
              </button>
            ) : (
              <button
                onClick={() => handleRpaControl("start")}
                disabled={controlLoading}
                className="w-full font-mono text-[9px] text-black hover:text-white uppercase text-center bg-[var(--umx-acid)] hover:bg-transparent border border-[var(--umx-acid)] py-1.5 transition-all font-bold"
                style={{ borderRadius: "2px" }}
              >
                {controlLoading ? "STARTING..." : "启动托管进程 (START)"}
              </button>
            )}
            {controlError && (
              <p className="font-mono text-[8px] text-[#ff6b6b] text-center mt-1 leading-snug">
                ⚠️ {controlError}
              </p>
            )}
          </div>
        </div>

        {/* Bound Account Card */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">WeChat Client Nickname</span>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-xl font-bold tracking-wide truncate max-w-full text-white">
                {isOnline && status?.wechat_nickname ? status.wechat_nickname : "未绑定"}
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-3">
              {isOnline ? "成功挂载 PC 微信 GUI 窗口" : "进程未启动或窗口丢失"}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
            <span className="block font-mono text-[8px] text-[var(--umx-text-dim)] uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }}>
              {isOnline ? "PID: 微信主窗口监听中" : "STATUS: 离线"}
            </span>
          </div>
        </div>

        {/* Analytics Card 1 */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Total Replies & Efficiency</span>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
                {totalReplies} 次回复
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
              平均思考响应时间: <span className="text-[var(--umx-acid)] font-bold">{avgThinkingTime.toFixed(1)}s</span>
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
            <span className="block font-mono text-[8px] text-white/60 uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }}>
              活跃波峰: {activeWindowStr}
            </span>
          </div>
        </div>

        {/* Auto Reply Mode Card */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Auto Reply Toggle</span>
              <button
                onClick={handleToggleBot}
                disabled={savingSettings}
                className={`font-mono text-[9px] px-2 py-0.5 border ${
                  isBotActive 
                    ? "border-[var(--umx-acid)] text-[var(--umx-acid)] bg-[var(--umx-acid)]/10" 
                    : "border-[var(--umx-line)] text-[var(--umx-text-dim)]"
                } transition-all uppercase`}
                style={{ borderRadius: "2px" }}
              >
                {savingSettings ? "SAVING..." : isBotActive ? "ACTIVE" : "PAUSED"}
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                {isBotActive ? "智能自动回复中" : "已暂停托管"}
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
              回复成功率: <span className="text-[var(--umx-acid)] font-bold">{successRate}%</span>
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
            <span className="block font-mono text-[8px] text-white/60 uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }}>
              规则模式: {listenChatsList.length > 0 ? `${listenChatsList.length} 人白名单` : "全局托管模式"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Section: Whitelist Control, Config Form & Log Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Whitelist & Rules Editor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Whitelist Manager */}
            <div className="border border-[var(--umx-line)] p-6 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[var(--umx-line)] pb-3">
                  <MessageSquare className="size-4 text-[var(--umx-acid)]" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">监听模式及联系人配置</h3>
                </div>

                {/* Mode Selector Segmented Bar */}
                <div className="grid grid-cols-2 gap-2 p-1 border border-[var(--umx-line)] bg-black/40 mb-4" style={{ borderRadius: "2px" }}>
                  <button
                    onClick={() => handleToggleListeningMode('global')}
                    disabled={savingSettings}
                    className={`font-mono text-[9px] py-2 uppercase tracking-wider transition-all font-bold ${
                      listeningMode === 'global'
                        ? "bg-[var(--umx-acid)] text-black font-extrabold"
                        : "text-[var(--umx-text-dim)] hover:text-white bg-transparent"
                    }`}
                    style={{ borderRadius: "1px" }}
                  >
                    🌐 全局监听模式
                  </button>
                  <button
                    onClick={() => handleToggleListeningMode('whitelist')}
                    disabled={savingSettings}
                    className={`font-mono text-[9px] py-2 uppercase tracking-wider transition-all font-bold ${
                      listeningMode === 'whitelist'
                        ? "bg-[var(--umx-acid)] text-black font-extrabold"
                        : "text-[var(--umx-text-dim)] hover:text-white bg-transparent"
                    }`}
                    style={{ borderRadius: "1px" }}
                  >
                    🔒 白名单过滤模式
                  </button>
                </div>

                {/* Conditional Display */}
                {listeningMode === 'global' ? (
                  <div className="p-4 border border-[var(--umx-acid)]/30 bg-[var(--umx-acid)]/5 space-y-2" style={{ borderRadius: "2px" }}>
                    <div className="flex items-center gap-2 text-[var(--umx-acid)] font-bold font-mono text-[10px] uppercase">
                      <ShieldAlert className="size-3.5 animate-pulse" />
                      全局自动回复处于激活状态
                    </div>
                    <p className="font-mono text-[9px] text-[var(--umx-text-dim)] leading-relaxed">
                      微信 RPA 将自动监听并智能回复<strong>所有</strong>未读会话（包括任意好友及微信群聊）。建议仅在自己测试或专用微信帐号下启用此模式。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="font-mono text-[9.5px] text-[var(--umx-text-dim)] leading-relaxed">
                      微信 RPA 将<strong>仅</strong>回复以下白名单中配置的联系人备注名或群聊全称。如果列表为空，将默认使用全局托管。
                    </p>

                    <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {listenChatsList.length === 0 ? (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-yellow-500 border border-yellow-500/30 px-2 py-1 bg-yellow-500/5">
                          ⚠️ 列表为空 - 请在下方添加联系人
                        </span>
                      ) : (
                        listenChatsList.map(chat => (
                          <span 
                            key={chat} 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] text-white border border-[var(--umx-line)] bg-white/5"
                            style={{ borderRadius: "2px" }}
                          >
                            {chat}
                            <button 
                              onClick={() => handleRemoveChat(chat)}
                              disabled={savingSettings}
                              className="text-[var(--umx-text-dim)] hover:text-[#ff6b6b] transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Input (Only shown in Whitelist mode!) */}
              {listeningMode === 'whitelist' && (
                <div className="mt-4 pt-4 border-t border-[var(--umx-line)]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChatName}
                      onChange={e => setNewChatName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddChat()}
                      placeholder="添加群聊全称或好友备注..."
                      disabled={savingSettings}
                      className="flex-1 bg-black/40 border border-[var(--umx-line)] px-3 py-2 font-mono text-[11px] text-white focus:border-white focus:outline-none placeholder:text-[var(--umx-text-dim)]"
                      style={{ borderRadius: "2px" }}
                    />
                    <button
                      onClick={handleAddChat}
                      disabled={savingSettings || !newChatName.trim()}
                      className="flex items-center justify-center border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-4 py-2 font-mono text-[10px] tracking-wider uppercase font-bold transition-all disabled:opacity-30"
                      style={{ borderRadius: "2px" }}
                    >
                      添加
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* AI & Automation Rules Config */}
            <div className="border border-[var(--umx-line)] p-6 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[var(--umx-line)] pb-3">
                  <Sparkles className="size-4 text-[var(--umx-acid)]" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">大模型及自动化策略</h3>
                </div>

                <div className="space-y-4">
                  {/* Reply Delay Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[9px]">
                      <span className="text-[var(--umx-text-dim)] uppercase">回复延迟时间 (Reply Delay)</span>
                      <span className="text-[var(--umx-acid)] font-bold">{replyDelay} 秒</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={replyDelay}
                        onChange={e => setReplyDelay(Number(e.target.value))}
                        disabled={savingRules}
                        className="flex-1 accent-[var(--umx-acid)] bg-neutral-850 h-1 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Group @-only Toggle */}
                  <div className="flex items-center justify-between border-t border-[var(--umx-line)]/40 pt-3">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-white">群聊仅回复 @ 消息</span>
                      <span className="block font-mono text-[7px] text-[var(--umx-text-dim)]">在群聊会话中，必须 @ 机器人时才自动回复</span>
                    </div>
                    <button
                      onClick={() => setGroupAtOnly(!groupAtOnly)}
                      disabled={savingRules}
                      className={`flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border border-neutral-700 p-0.5 transition-colors ${
                        groupAtOnly ? "bg-[var(--umx-acid)]" : "bg-neutral-900"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                          groupAtOnly ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* File Push Toggle */}
                  <div className="flex items-center justify-between border-t border-[var(--umx-line)]/40 pt-3">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-white">智能文件/图片推送</span>
                      <span className="block font-mono text-[7px] text-[var(--umx-text-dim)]">支持大模型生成图片、文档时自动推送到微信</span>
                    </div>
                    <button
                      onClick={() => setFilePushEnabled(!filePushEnabled)}
                      disabled={savingRules}
                      className={`flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border border-neutral-700 p-0.5 transition-colors ${
                        filePushEnabled ? "bg-[var(--umx-acid)]" : "bg-neutral-900"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                          filePushEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--umx-line)] flex flex-col gap-2">
                {saveError && (
                  <div className="text-[#ff6b6b] font-mono text-[8px] bg-red-950/20 border border-red-500/20 p-2 leading-snug" style={{ borderRadius: "2px" }}>
                    ⚠️ 错误: {saveError}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] text-[var(--umx-acid)] uppercase">
                    {rulesSuccess ? "✓ 已同步到本地" : ""}
                  </span>
                  <button
                    onClick={handleSaveRules}
                    disabled={savingRules}
                    className="flex items-center justify-center border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-5 py-2 font-mono text-[10px] tracking-wider uppercase font-bold transition-all disabled:opacity-30"
                    style={{ borderRadius: "2px" }}
                  >
                    {savingRules ? "同步中..." : "保存AI策略"}
                  </button>
                </div>
              </div>
            </div>
          </div>


        </div>

        {/* Right Side: Terminal/Log Console */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="border border-[var(--umx-line)] p-6 flex flex-col h-full justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-[var(--umx-acid)] animate-pulse" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">运行日志终端</h3>
                </div>
                <span className="font-mono text-[9px] text-[var(--umx-text-dim)] uppercase tracking-wider">
                  {isOnline ? "🔴 4s 心跳轮询" : "⏳ 进程已离线"}
                </span>
              </div>

              {/* Console Box */}
              <div className="bg-black/90 border border-[var(--umx-line)] p-4 font-mono text-[10px] text-[var(--umx-silver)] flex-1 min-h-[300px] max-h-[460px] overflow-y-auto space-y-1.5 select-text selection:bg-[var(--umx-acid)] selection:text-black">
                {(!status?.system_logs || status.system_logs.length === 0) ? (
                  <div className="flex items-center justify-center h-full text-[var(--umx-text-dim)] uppercase tracking-wider text-center">
                    WAITING FOR LIVE TELEMETRY LOGS STREAM...
                  </div>
                ) : (
                  status.system_logs.map((log, i) => {
                    let colorClass = "text-[var(--umx-silver)]";
                    if (log.includes("[ERROR]")) colorClass = "text-[#ff6b6b]";
                    else if (log.includes("[WARNING]")) colorClass = "text-yellow-400";
                    else if (log.includes("[思考开始]") || log.includes("触发AI思考")) colorClass = "text-cyan-400";
                    else if (log.includes("[思考完成]") || log.includes("成功送达")) colorClass = "text-[var(--umx-acid)]";
                    
                    return (
                      <div key={i} className={`leading-relaxed break-all ${colorClass}`}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--umx-line)] flex items-center justify-between">
              <span className="font-mono text-[8px] text-[var(--umx-text-dim)]">
                TELEMETRY ACTIVE
              </span>
              <button 
                onClick={() => {
                  if (status) {
                    setStatus({ ...status, system_logs: [] });
                  }
                }}
                className="font-mono text-[8px] text-[var(--umx-text-dim)] hover:text-white uppercase tracking-wider border border-[var(--umx-line)] px-2 py-1 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                CLEAR CONSOLE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. History Feed Table */}
      <div className="border border-[var(--umx-line)] p-6" style={{ background: "rgba(255,255,255,0.01)" }}>
        <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[var(--umx-acid)]" />
            <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">自动回复历史日志 (Auto-Reply History)</h3>
          </div>
          <span className="font-mono text-[9px] text-[var(--umx-text-dim)] uppercase">
            最近 50 条匹配记录
          </span>
        </div>

        <div className="overflow-x-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="mb-3 size-8 text-[var(--umx-text-dim)]" />
              <p className="font-mono text-[11px] text-[var(--umx-text-dim)]">
                暂无自动回复历史记录
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--umx-line)] bg-white/[0.01] select-none">
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[12%]">时间</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[15%]">会话窗口</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[10%]">发言人</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[25%]">收到的消息</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[25%]">AI 的自动回复</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[8%]">耗时</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[5%]">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--umx-line)]">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-text-dim)]">
                      {new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-white font-bold truncate max-w-[120px]">
                      {row.chat_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-silver)] truncate max-w-[100px]">
                      {row.sender}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-text-dim)] max-w-[200px] truncate" title={row.message}>
                      {row.message}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-white max-w-[200px] truncate" title={row.response}>
                      {row.response}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px]">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[var(--umx-line)] text-[var(--umx-silver)]" style={{ borderRadius: "2px" }}>
                        <Timer className="size-2.5" />
                        {formatElapsed(row.elapsed_time)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {row.status === "success" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] border border-[var(--umx-acid)]/30 text-[var(--umx-acid)] bg-[var(--umx-acid)]/10" style={{ borderRadius: "2px" }}>
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] border border-red-500/30 text-[#ff6b6b] bg-red-500/10" style={{ borderRadius: "2px" }}>
                          ERROR
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

interface WeChatStatusRow {
  client_status: string;
  last_heartbeat: string | null;
  wechat_nickname: string;
  active_workers: number;
  system_logs: string[];
  updated_at: string;
}

interface WeChatSettingsRow {
  listen_chats: string;
  listen_mode: string;
  is_active: boolean;
  system_prompt: string;
  reply_delay: number;
  group_at_only: boolean;
  file_push_enabled: boolean;
}

interface WeChatHistoryRow {
  id: string;
  chat_name: string;
  sender: string;
  message: string;
  response: string;
  status: string;
  elapsed_time: number;
  created_at: string;
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
