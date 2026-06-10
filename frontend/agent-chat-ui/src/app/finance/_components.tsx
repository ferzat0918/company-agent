"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Trash2, X } from "lucide-react";

/* ── Section label (§NN TITLE) — 同 profile / admin 页 ── */

export function SectionLabel({
  index,
  title,
  subtitle,
  right,
}: {
  index: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-acid)]">
          §{index}
        </span>
        <h2 className="m-0 font-display text-xl font-bold uppercase tracking-[0.14em] text-[var(--umx-white)]">
          {title}
        </h2>
        {subtitle && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]">
            · {subtitle}
          </span>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

/* ── Data table — UMX 直角线框、深底、银色横线 ─────────── */

type Column<T> = {
  key: string;
  header: string;
  width?: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

export type RowSelection<T> = {
  selectedIds: Set<string>;
  getId: (row: T) => string;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allChecked: boolean;
  someChecked: boolean;
};

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="size-3.5 cursor-pointer accent-[var(--umx-acid)]"
    />
  );
}

export function DataTable<T>({
  columns,
  rows,
  empty = "无数据 / NO DATA",
  rowKey,
  selection,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey?: (row: T, i: number) => string | number;
  selection?: RowSelection<T>;
}) {
  return (
    <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)]">
      <div className="umx-scrollbar overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--umx-line)] bg-[var(--umx-bg-2)]">
              {selection && (
                <th className="px-4 py-3" style={{ width: "44px" }}>
                  <SelectAllCheckbox
                    checked={selection.allChecked}
                    indeterminate={selection.someChecked && !selection.allChecked}
                    onChange={selection.onToggleAll}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--umx-text-dim)]",
                    c.className,
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-4 py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const rid = selection ? selection.getId(r) : null;
                const isSelected =
                  !!selection && rid !== null && selection.selectedIds.has(rid);
                return (
                  <tr
                    key={
                      rowKey
                        ? rowKey(r, i)
                        : ((r as { id?: string | number }).id ?? i)
                    }
                    className={cn(
                      "border-b border-[var(--umx-line)] last:border-b-0 hover:bg-[var(--umx-bg-2)]/40",
                      isSelected && "bg-[var(--umx-acid)]/5",
                    )}
                  >
                    {selection && rid !== null && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => selection.onToggleRow(rid)}
                          className="size-3.5 cursor-pointer accent-[var(--umx-acid)]"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-3 text-[13px] text-[var(--umx-white)]",
                          c.className,
                        )}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── 多选状态 hook — 基于当前筛选结果集合 ─────────────── */

export function useRowSelection<T extends { id: string }>(rows: T[]) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // 数据刷新 / 筛选变化后，剔除已不在当前结果里的 id（防幽灵选中）
  React.useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(rows.map((r) => r.id));
      const next = new Set(Array.from(prev).filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const allChecked =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const selection: RowSelection<T> = {
    selectedIds,
    getId: (r) => r.id,
    onToggleRow: (id) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onToggleAll: () => {
      if (allChecked) setSelectedIds(new Set());
      else
        setSelectedIds(
          (prev) => new Set([...Array.from(prev), ...rows.map((r) => r.id)]),
        );
    },
    allChecked,
    someChecked: selectedIds.size > 0,
  };

  const clear = React.useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, selection, clear };
}

/* ── 批量操作栏 — 选中 >0 时浮现在表格上方 ────────────── */

export function BulkActionBar({
  count,
  deleting = false,
  onDelete,
  onExport,
  onClear,
}: {
  count: number;
  deleting?: boolean;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 border border-[var(--umx-acid)] bg-[var(--umx-acid)]/5 px-4 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--umx-acid)]">
        已选 {count} 项
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="gap-1.5"
        >
          <Download className="size-3" />
          导出选中
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="gap-1.5 border-[#ff6b6b]/60 text-[#ff6b6b] hover:text-[#ff6b6b]"
        >
          {deleting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          批量删除
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
          <X className="size-3" />
          取消选择
        </Button>
      </div>
    </div>
  );
}

/* ── Input — 直角、深底、聚焦时荧光绿描边 ───────────── */

export function FinanceInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 font-mono text-[12px] text-[var(--umx-white)]",
        "outline-none placeholder:text-[var(--umx-text-dim)]",
        "focus:border-[var(--umx-acid)] focus:ring-1 focus:ring-[var(--umx-acid)]/40",
        "disabled:opacity-50",
        className,
      )}
    />
  );
}

export function FinanceSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-2 font-mono text-[12px] text-[var(--umx-white)]",
        "outline-none focus:border-[var(--umx-acid)] focus:ring-1 focus:ring-[var(--umx-acid)]/40",
        "disabled:opacity-50",
        className,
      )}
    >
      {children}
    </select>
  );
}

/* ── SearchableSelect — 带有输入过滤与下拉搜索的物料选择器 ── */

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "输入关键字搜索...",
  disabled = false,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      setSearch(selectedOption ? selectedOption.label : "");
    }
  }, [value, open, selectedOption]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={open ? search : (selectedOption ? selectedOption.label : "")}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          placeholder={placeholder}
          className={cn(
            "h-9 w-full border border-[var(--umx-line)] bg-[var(--umx-bg-2)] pl-3 pr-8 font-mono text-[12px] text-[var(--umx-white)]",
            "outline-none focus:border-[var(--umx-acid)] focus:ring-1 focus:ring-[var(--umx-acid)]/40",
            "disabled:opacity-50 cursor-pointer",
            open && "border-[var(--umx-acid)] ring-1 ring-[var(--umx-acid)]/40"
          )}
        />
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--umx-text-dim)]">
          <ChevronDown className="size-4" />
        </div>
      </div>

      {open && !disabled && (
        <div className="umx-scrollbar absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto border border-[var(--umx-line)] bg-[var(--umx-bg-1)] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 font-mono text-[11px] text-[var(--umx-text-dim)]">
              未找到匹配项
            </div>
          ) : (
            filtered.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full text-left px-3 py-2 font-mono text-[12px] transition-colors cursor-pointer",
                    isSelected
                      ? "bg-[var(--umx-acid)] text-black font-bold"
                      : "text-[var(--umx-white)] hover:bg-[var(--umx-bg-2)]"
                  )}
                >
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function FinanceTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[72px] w-full border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2 font-body text-[13px] text-[var(--umx-white)]",
        "outline-none placeholder:text-[var(--umx-text-dim)]",
        "focus:border-[var(--umx-acid)] focus:ring-1 focus:ring-[var(--umx-acid)]/40",
        "disabled:opacity-50",
        className,
      )}
    />
  );
}

export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-silver)]">
      {children}
      {required && (
        <span className="ml-1 text-[var(--umx-acid)]">*</span>
      )}
    </label>
  );
}

/* ── Toast (super-minimal) — 操作反馈 ─────────────────── */

type ToastKind = "ok" | "err" | "info";

export function useToast() {
  const [toast, setToast] = React.useState<{ kind: ToastKind; msg: string } | null>(
    null,
  );

  const show = React.useCallback((kind: ToastKind, msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const node = toast ? (
    <div
      className="fixed bottom-6 right-6 z-50 border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] shadow-lg"
      style={{
        background:
          toast.kind === "ok"
            ? "rgba(218,252,8,0.08)"
            : toast.kind === "err"
            ? "rgba(255,59,59,0.08)"
            : "rgba(255,255,255,0.04)",
        borderColor:
          toast.kind === "ok"
            ? "var(--umx-acid)"
            : toast.kind === "err"
            ? "#ff6b6b"
            : "var(--umx-line)",
        color:
          toast.kind === "ok"
            ? "var(--umx-acid)"
            : toast.kind === "err"
            ? "#ff6b6b"
            : "var(--umx-white)",
      }}
    >
      {toast.msg}
    </div>
  ) : null;

  return { show, node };
}

/* ── Stat tile (库存总览用) ───────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "acid" | "warn" | "alert";
}) {
  const color =
    tone === "acid"
      ? "var(--umx-acid)"
      : tone === "warn"
      ? "#fbbf24"
      : tone === "alert"
      ? "#ff6b6b"
      : "var(--umx-white)";
  return (
    <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]">
        {label}
      </div>
      <div
        className="font-display text-[32px] font-bold leading-none"
        style={{ color }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--umx-text-dim)]">
          {hint}
        </div>
      )}
    </div>
  );
}

/* ── 类型字典（与 DDL 中 move_type 约定一致） ───────── */

export const MATERIAL_MOVE_TYPES = [
  "采购入库",
  "生产领料",
  "退货出库",
  "报损出库",
  "领用出库",
] as const;

export const PRODUCT_MOVE_TYPES = [
  "生产入库",
  "退货入库",
  "销售出库",
  "领用出库",
  "报损出库",
] as const;

export const MATERIAL_IN_TYPES = ["采购入库"] as const;
export const MATERIAL_OUT_TYPES = [
  "生产领料",
  "退货出库",
  "报损出库",
  "领用出库",
] as const;

export const PRODUCT_IN_TYPES = ["生产入库", "退货入库"] as const;
export const PRODUCT_OUT_TYPES = [
  "销售出库",
  "领用出库",
  "报损出库",
] as const;

export const PLATFORMS = ["淘宝", "小红书", "京东", "抖音", "线下"] as const;
