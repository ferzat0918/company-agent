"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronRight,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  DataTable,
  FinanceInput,
  FinanceSelect,
  SectionLabel,
  StatTile,
} from "./_components";

type InventoryRow = {
  kind: "product" | "material";
  code: string;
  name: string;
  min_stock: number;
  max_stock: number;
  in_qty: number;
  out_qty: number;
  stock: number;
};

type WarnLevel = "ok" | "low" | "high";

function warnOf(row: InventoryRow): WarnLevel {
  if (row.min_stock && row.stock <= row.min_stock) return "low";
  if (row.max_stock && row.stock >= row.max_stock) return "high";
  return "ok";
}

export default function FinanceDashboardPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | "product" | "material">(
    "all",
  );
  const [warnFilter, setWarnFilter] = useState<"all" | "low" | "high">("all");
  const [query, setQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fin_inventory")
      .select("*")
      .order("kind")
      .order("code");
    if (!error && data) setRows(data as InventoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      const lvl = warnOf(r);
      if (warnFilter !== "all" && warnFilter !== lvl) return false;
      if (q && !`${r.code} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, kindFilter, warnFilter, query]);

  const stats = useMemo(() => {
    const total = rows.length;
    const products = rows.filter((r) => r.kind === "product").length;
    const materials = rows.filter((r) => r.kind === "material").length;
    const low = rows.filter((r) => warnOf(r) === "low").length;
    const high = rows.filter((r) => warnOf(r) === "high").length;
    return { total, products, materials, low, high };
  }, [rows]);

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {/* ── 顶部 hero ── */}
      <header className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-acid)]">
          § FINANCE / INVENTORY DASHBOARD
        </div>
        <h1 className="m-0 font-display text-3xl font-bold uppercase tracking-[0.10em] text-[var(--umx-white)]">
          库存总览 · STOCK OVERVIEW
        </h1>
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-[var(--umx-silver)]">
          以流水账自动汇总库存。低于最低预警 / 高于最高预警的条目以红字与琥珀色高亮。
          数据由 Supabase 视图 <code className="font-mono text-[11px] text-[var(--umx-acid)]">fin_inventory</code> 实时计算，不存物化表。
        </p>
      </header>

      {/* ── 统计区 ── */}
      <section>
        <SectionLabel index="01" title="SNAPSHOT" subtitle="实时统计" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="TOTAL ITEMS / 条目总数" value={stats.total} />
          <StatTile label="PRODUCTS / 成品" value={stats.products} />
          <StatTile label="MATERIALS / 原料" value={stats.materials} />
          <StatTile
            label="LOW STOCK / 缺货"
            value={stats.low}
            tone={stats.low > 0 ? "alert" : "default"}
            hint={stats.low > 0 ? "需补货" : "全部安全"}
          />
          <StatTile
            label="OVERSTOCK / 积压"
            value={stats.high}
            tone={stats.high > 0 ? "warn" : "default"}
            hint={stats.high > 0 ? "需去库存" : "全部正常"}
          />
        </div>
      </section>

      {/* ── 库存明细 ── */}
      <section>
        <SectionLabel
          index="02"
          title="INVENTORY"
          subtitle="库存明细"
          right={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
                REFRESH
              </Button>
            </>
          }
        />

        {/* 筛选器 */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
            <FinanceInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索编号 / 名称"
              className="h-9 w-64 pl-7"
            />
          </div>
          <FinanceSelect
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as "all" | "product" | "material")
            }
            className="w-32"
          >
            <option value="all">全部类型</option>
            <option value="product">成品</option>
            <option value="material">原料</option>
          </FinanceSelect>
          <FinanceSelect
            value={warnFilter}
            onChange={(e) =>
              setWarnFilter(e.target.value as "all" | "low" | "high")
            }
            className="w-32"
          >
            <option value="all">全部状态</option>
            <option value="low">缺货</option>
            <option value="high">积压</option>
          </FinanceSelect>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
            {filtered.length} / {rows.length}
          </span>
        </div>

        <DataTable
          rows={filtered}
          rowKey={(r) => `${r.kind}:${r.code}`}
          empty={
            loading ? "LOADING..." : "尚无库存数据，请先在档案 / 流水录入"
          }
          columns={[
            {
              key: "kind",
              header: "TYPE",
              width: "80px",
              render: (r) => (
                <span
                  className="border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    borderColor:
                      r.kind === "product"
                        ? "var(--umx-acid)"
                        : "var(--umx-violet)",
                    color:
                      r.kind === "product"
                        ? "var(--umx-acid)"
                        : "var(--umx-violet)",
                  }}
                >
                  {r.kind === "product" ? "成品" : "原料"}
                </span>
              ),
            },
            {
              key: "code",
              header: "CODE / 编号",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-white)]">
                  {r.code}
                </span>
              ),
            },
            { key: "name", header: "NAME / 名称", render: (r) => r.name },
            {
              key: "in",
              header: "IN / 入库",
              className: "text-right",
              render: (r) => (
                <span className="inline-flex items-center gap-1 font-mono text-[12px] text-[var(--umx-silver)]">
                  <ArrowDown className="size-3 text-[var(--umx-acid)]" />
                  {fmt(r.in_qty)}
                </span>
              ),
            },
            {
              key: "out",
              header: "OUT / 出库",
              className: "text-right",
              render: (r) => (
                <span className="inline-flex items-center gap-1 font-mono text-[12px] text-[var(--umx-silver)]">
                  <ArrowUp className="size-3 text-[var(--umx-violet)]" />
                  {fmt(r.out_qty)}
                </span>
              ),
            },
            {
              key: "stock",
              header: "STOCK / 现库存",
              className: "text-right",
              render: (r) => {
                const lvl = warnOf(r);
                const color =
                  lvl === "low"
                    ? "#ff6b6b"
                    : lvl === "high"
                    ? "#fbbf24"
                    : "var(--umx-white)";
                return (
                  <span
                    className="font-mono text-[14px] font-bold"
                    style={{ color }}
                  >
                    {fmt(r.stock)}
                  </span>
                );
              },
            },
            {
              key: "range",
              header: "MIN / MAX",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[10px] tracking-[0.04em] text-[var(--umx-text-dim)]">
                  {fmt(r.min_stock)} → {fmt(r.max_stock)}
                </span>
              ),
            },
            {
              key: "warn",
              header: "STATUS",
              width: "180px",
              render: (r) => {
                const lvl = warnOf(r);
                if (lvl === "low")
                  return (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff6b6b]">
                      <AlertTriangle className="size-3" />
                      缺货 · 请补库
                    </span>
                  );
                if (lvl === "high")
                  return (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#fbbf24]">
                      <AlertTriangle className="size-3" />
                      积压 · 请去库
                    </span>
                  );
                return (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
                    OK
                  </span>
                );
              },
            },
          ]}
        />
      </section>

      {/* ── 快捷入口 ── */}
      <section>
        <SectionLabel index="03" title="QUICK ACCESS" subtitle="快捷入口" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <QuickLink
            href="/finance/moves"
            icon={<Boxes className="size-4" />}
            title="录入出入库流水"
            hint="新建采购 / 销售 / 报损 等记录"
          />
          <QuickLink
            href="/finance/boms"
            icon={<PackageSearch className="size-4" />}
            title="维护 BOM 配方"
            hint="挂载成品 ↔ 原料用量"
          />
          <QuickLink
            href="/finance/import-export"
            icon={<RefreshCw className="size-4" />}
            title="导入 / 导出 Excel"
            hint="一键灌入原 Excel 数据"
          />
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-5 transition-colors hover:border-[var(--umx-acid)]"
    >
      <div>
        <div className="mb-1 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-[var(--umx-white)]">
          <span className="text-[var(--umx-acid)]">{icon}</span>
          {title}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
          {hint}
        </div>
      </div>
      <ChevronRight className="size-4 text-[var(--umx-text-dim)] transition-colors group-hover:text-[var(--umx-acid)]" />
    </Link>
  );
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
