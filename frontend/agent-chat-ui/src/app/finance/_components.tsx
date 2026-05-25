"use client";

import React from "react";
import { cn } from "@/lib/utils";

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

export function DataTable<T>({
  columns,
  rows,
  empty = "无数据 / NO DATA",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey?: (row: T, i: number) => string | number;
}) {
  return (
    <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)]">
      <div className="umx-scrollbar overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--umx-line)] bg-[var(--umx-bg-2)]">
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
                  colSpan={columns.length}
                  className="px-4 py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={
                    rowKey
                      ? rowKey(r, i)
                      : ((r as { id?: string | number }).id ?? i)
                  }
                  className="border-b border-[var(--umx-line)] last:border-b-0 hover:bg-[var(--umx-bg-2)]/40"
                >
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
              ))
            )}
          </tbody>
        </table>
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
