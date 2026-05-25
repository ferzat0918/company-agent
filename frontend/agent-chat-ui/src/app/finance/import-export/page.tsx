"use client";

import React, { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  Download,
  FileSpreadsheet,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { SectionLabel, useToast } from "../_components";
import { useAuth } from "@/providers/Auth";

type Bundle = {
  products: Record<string, unknown>[];
  materials: Record<string, unknown>[];
  boms: Record<string, unknown>[];
  moves: Record<string, unknown>[];
};

const TABLE_LABELS: Record<keyof Bundle, string> = {
  products: "成品档案 / PRODUCTS",
  materials: "原料档案 / MATERIALS",
  boms: "BOM 配方 / BOMS",
  moves: "出入库流水 / MOVES",
};

const TABLE_TO_FIN: Record<keyof Bundle, string> = {
  products: "fin_products",
  materials: "fin_materials",
  boms: "fin_boms",
  moves: "fin_stock_moves",
};

export default function FinanceImportExportPage() {
  const { user } = useAuth();
  const fileRefMagic = useRef<HTMLInputElement>(null);
  const fileRefGeneric = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const { show, node: toastNode } = useToast();

  function appendLog(line: string) {
    setLog((l) => [...l, `[${new Date().toLocaleTimeString("zh-CN")}] ${line}`]);
  }

  /* ──────────────────────────────────────────────────────
   * 导出：每张表导成 .xlsx + .csv（一键打包到 ZIP 太重，分按钮）
   * ────────────────────────────────────────────────────── */

  async function exportTable(table: keyof Bundle, format: "xlsx" | "csv") {
    setWorking(true);
    appendLog(`导出 ${TABLE_LABELS[table]} (${format.toUpperCase()})...`);
    const { data, error } = await supabase
      .from(TABLE_TO_FIN[table])
      .select("*")
      .order(table === "moves" ? "occurred_at" : "code");
    setWorking(false);
    if (error || !data) {
      appendLog(`× 失败：${error?.message ?? "no data"}`);
      show("err", `导出失败：${error?.message}`);
      return;
    }
    if (data.length === 0) {
      appendLog("× 表是空的，没有内容可导出");
      show("err", "该表为空");
      return;
    }
    const fname = `${table}_${dateTag()}.${format}`;
    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, table);
      XLSX.writeFile(wb, fname);
    } else {
      const csv = Papa.unparse(data);
      // Prepend UTF-8 BOM so Excel opens the CSV with the right encoding
      const blob = new Blob(["﻿" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      triggerDownload(blob, fname);
    }
    appendLog(`✓ ${fname} 已下载 (${data.length} 行)`);
    show("ok", `${fname} 已下载`);
  }

  async function exportAll() {
    setWorking(true);
    appendLog("打包全部 4 张表到一个 Excel 工作簿...");
    const tables: (keyof Bundle)[] = ["products", "materials", "boms", "moves"];
    const wb = XLSX.utils.book_new();
    for (const t of tables) {
      const { data } = await supabase
        .from(TABLE_TO_FIN[t])
        .select("*")
        .order(t === "moves" ? "occurred_at" : "code");
      const ws = XLSX.utils.json_to_sheet(data ?? []);
      XLSX.utils.book_append_sheet(wb, ws, t);
      appendLog(`  · ${t}: ${(data ?? []).length} 行`);
    }
    const fname = `finance_full_${dateTag()}.xlsx`;
    XLSX.writeFile(wb, fname);
    setWorking(false);
    appendLog(`✓ ${fname} 已下载`);
    show("ok", "全量导出完成");
  }

  /* ──────────────────────────────────────────────────────
   * 通用导入：CSV / Excel 通用，按 sheet 名匹配 fin_* 表
   * ────────────────────────────────────────────────────── */

  async function importGeneric(file: File) {
    setWorking(true);
    appendLog(`读取 ${file.name}...`);

    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        });
        const tableName = guessTableFromHeaders(parsed.meta.fields ?? []);
        if (!tableName) {
          appendLog("× CSV 列名无法判断对应表，请用专用导入或重命名");
          show("err", "无法识别 CSV 表头");
          return;
        }
        await upsertRows(tableName, parsed.data as Record<string, unknown>[]);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: null,
          });
          if (json.length === 0) {
            appendLog(`  · 跳过空 sheet：${sheetName}`);
            continue;
          }
          const t = TABLE_TO_FIN[sheetName as keyof Bundle];
          if (t) {
            await upsertRows(t, json);
          } else {
            appendLog(`  · 跳过未识别 sheet：${sheetName}`);
          }
        }
      }
      show("ok", "导入完成");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`× 导入异常：${msg}`);
      show("err", `导入异常：${msg}`);
    } finally {
      setWorking(false);
    }
  }

  async function upsertRows(table: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;
    appendLog(`  · ${table}: 准备插入 ${rows.length} 行...`);
    // 不带 id 时由 DB 生成；带 id 时也保留（用于覆盖）
    const cleaned = rows.map((r) => stripEmpty(r));
    const onConflict =
      table === "fin_products" || table === "fin_materials" ? "code" : undefined;
    const q = supabase.from(table).upsert(cleaned, { onConflict });
    const { error, count } = await q;
    if (error) {
      appendLog(`    × ${error.message}`);
    } else {
      appendLog(`    ✓ 完成 (${count ?? rows.length} 行)`);
    }
  }

  /* ──────────────────────────────────────────────────────
   * 一键导入：专吃原 Excel "3带BOM的出入库管理系统.xlsx"
   * ────────────────────────────────────────────────────── */

  async function importMagic(file: File) {
    setWorking(true);
    setLog([]);
    appendLog(`× 开始一键解析 ${file.name}...`);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheetNames = wb.SheetNames;
      appendLog(`  读到 ${sheetNames.length} 张 sheet：${sheetNames.join(" / ")}`);

      const get = (name: string) => {
        const ws = wb.Sheets[name];
        if (!ws) return [] as unknown[][];
        return XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: null,
        }) as unknown[][];
      };

      const baseSheet = sheetNames.find((s) => s.includes("基础信息")) ?? "基础信息表";
      const bomSheet = sheetNames.find((s) => s.includes("BOM")) ?? "BOM清单";
      const matMoveSheet =
        sheetNames.find((s) => s.includes("原材料出入库") || s.includes("原料出入库")) ??
        "原材料出入库表";
      const prodMoveSheet =
        sheetNames.find((s) => s.includes("成品出入库")) ?? "成品出入库表";

      const baseRows = get(baseSheet);
      const bomRows = get(bomSheet);
      const matMoveRows = get(matMoveSheet);
      const prodMoveRows = get(prodMoveSheet);

      /* —— 基础信息：成品在 A:C，原料在 E:I —— */
      const products: Record<string, unknown>[] = [];
      const materials: Record<string, unknown>[] = [];
      for (let i = 2; i < baseRows.length; i++) {
        const row = baseRows[i] ?? [];
        const pCode = (row[0] as string | null)?.toString().trim();
        const pName = (row[1] as string | null)?.toString().trim();
        const pPrice = toNum(row[2]);
        if (pCode && pName) {
          products.push({
            code: pCode,
            name: pName,
            price: pPrice ?? 0,
            min_stock: 0,
            max_stock: 0,
            created_by: user?.id,
          });
        }
        const mCode = (row[4] as string | null)?.toString().trim();
        const mName = (row[5] as string | null)?.toString().trim();
        const mPrice = toNum(row[6]);
        const mMin = toNum(row[7]) ?? 0;
        const mMax = toNum(row[8]) ?? 0;
        if (mCode && mName) {
          materials.push({
            code: mCode,
            name: mName,
            unit_price: mPrice ?? 0,
            min_stock: mMin,
            max_stock: mMax,
            created_by: user?.id,
          });
        }
      }
      appendLog(`  · 解析到 ${products.length} 个成品、${materials.length} 个原料`);

      /* —— BOM：A=成品编号 C=原料编号 E=用量 F=单价 H=损耗 J=备注 —— */
      const boms: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      for (let i = 2; i < bomRows.length; i++) {
        const row = bomRows[i] ?? [];
        const pCode = (row[0] as string | null)?.toString().trim();
        const mCode = (row[2] as string | null)?.toString().trim();
        const qty = toNum(row[4]);
        const loss = toNum(row[7]) ?? 0;
        const note = (row[9] as string | null)?.toString().trim() || null;
        if (!pCode || !mCode || qty === null) continue;
        const k = `${pCode}|${mCode}`;
        if (seen.has(k)) {
          appendLog(`    · 跳过重复 BOM 行 ${pCode} ← ${mCode}`);
          continue;
        }
        seen.add(k);
        boms.push({
          product_code: pCode,
          material_code: mCode,
          qty,
          loss_rate: loss,
          note,
        });
      }
      appendLog(`  · 解析到 ${boms.length} 条 BOM 配方`);

      /* —— 原料出入库：序号A 年份B 时间C 类型D 对应产品E 原料F 名称G 规格H 数量I 单价J 金额K 备注L —— */
      const moves: Record<string, unknown>[] = [];
      const matTypeMap: Record<string, string> = {
        采购入库: "采购入库",
        "报损出库（需要走报损流程）": "报损出库",
        报损出库: "报损出库",
        生产出库: "生产领料",
        生产领料: "生产领料",
        退货出库: "退货出库",
        领用出库: "领用出库",
      };
      for (let i = 2; i < matMoveRows.length; i++) {
        const row = matMoveRows[i] ?? [];
        const t = (row[3] as string | null)?.toString().trim();
        const code = (row[5] as string | null)?.toString().trim();
        const qty = toNum(row[8]);
        if (!t || !code || qty === null) continue;
        const mappedType = matTypeMap[t];
        if (!mappedType) {
          appendLog(`    · 跳过未识别原料类型：${t}`);
          continue;
        }
        moves.push({
          kind: "material",
          code,
          move_type: mappedType,
          qty,
          unit_price: toNum(row[9]),
          ref_product_code: (row[4] as string | null)?.toString().trim() || null,
          occurred_at: toIsoDate(row[2]) ?? new Date().toISOString(),
          note: (row[11] as string | null)?.toString().trim() || null,
          created_by: user?.id,
        });
      }

      /* —— 成品出入库：A序号 B年份 C时间 D类型 E平台 F客户 G回购 H成品编号 I名称 J数量 K售价 L金额 M回款 N备注 —— */
      const prodTypeMap: Record<string, string> = {
        销售出库: "销售出库",
        退货入库: "退货入库",
        领用出库: "领用出库",
        报损出库: "报损出库",
        生产入库: "生产入库",
      };
      for (let i = 2; i < prodMoveRows.length; i++) {
        const row = prodMoveRows[i] ?? [];
        const t = (row[3] as string | null)?.toString().trim();
        const code = (row[7] as string | null)?.toString().trim();
        const qty = toNum(row[9]);
        if (!t || !code || qty === null) continue;
        const mappedType = prodTypeMap[t];
        if (!mappedType) {
          appendLog(`    · 跳过未识别成品类型：${t}`);
          continue;
        }
        moves.push({
          kind: "product",
          code,
          move_type: mappedType,
          qty,
          unit_price: toNum(row[10]),
          platform: (row[4] as string | null)?.toString().trim() || null,
          customer: (row[5] as string | null)?.toString().trim() || null,
          is_repurchase: !!(row[6] as unknown),
          payment_date: toIsoDate(row[12])?.slice(0, 10) ?? null,
          occurred_at: toIsoDate(row[2]) ?? new Date().toISOString(),
          note: (row[13] as string | null)?.toString().trim() || null,
          created_by: user?.id,
        });
      }
      appendLog(`  · 解析到 ${moves.length} 条出入库流水`);

      /* —— 顺序写入：先档案，再 BOM，再流水 —— */
      appendLog("开始写入数据库...");

      if (products.length > 0) {
        const { error } = await supabase
          .from("fin_products")
          .upsert(products, { onConflict: "code" });
        if (error) throw new Error("成品写入失败：" + error.message);
        appendLog(`  ✓ 成品 ${products.length} 行`);
      }
      if (materials.length > 0) {
        const { error } = await supabase
          .from("fin_materials")
          .upsert(materials, { onConflict: "code" });
        if (error) throw new Error("原料写入失败：" + error.message);
        appendLog(`  ✓ 原料 ${materials.length} 行`);
      }
      if (boms.length > 0) {
        const { error } = await supabase
          .from("fin_boms")
          .upsert(boms, { onConflict: "product_code,material_code" });
        if (error) throw new Error("BOM 写入失败：" + error.message);
        appendLog(`  ✓ BOM ${boms.length} 行`);
      }
      if (moves.length > 0) {
        const { error } = await supabase.from("fin_stock_moves").insert(moves);
        if (error) throw new Error("流水写入失败：" + error.message);
        appendLog(`  ✓ 流水 ${moves.length} 行`);
      }

      appendLog("✓ 一键导入完成！");
      show("ok", "一键导入完成");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`× 异常：${msg}`);
      show("err", msg);
    } finally {
      setWorking(false);
    }
  }

  /* ──────────────────────────────────────────────────────
   * UI
   * ────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <SectionLabel
        index="01"
        title="MAGIC IMPORT"
        subtitle="一键导入原 Excel"
      />
      <div className="border border-[var(--umx-acid)] bg-[var(--umx-bg-1)] p-6">
        <div className="mb-4 flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--umx-acid)]" />
          <div>
            <h3 className="m-0 font-display text-base font-bold uppercase tracking-[0.10em] text-[var(--umx-white)]">
              专吃《3带BOM的出入库管理系统.xlsx》
            </h3>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-[var(--umx-silver)]">
              选中原 Excel 文件，自动识别基础信息表 / BOM清单 / 原材料出入库表 /
              成品出入库表 4 张 sheet，按字段映射写入对应 fin_* 表。
              已存在的成品 / 原料 / BOM 会按编号覆盖；出入库流水追加写入。
            </p>
          </div>
        </div>

        <input
          ref={fileRefMagic}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importMagic(f);
            e.target.value = "";
          }}
        />

        <Button
          variant="acid"
          size="lg"
          disabled={working}
          onClick={() => fileRefMagic.current?.click()}
          className="gap-2"
        >
          {working ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {working ? "PROCESSING..." : "选 Excel 文件 → 一键导入"}
        </Button>
      </div>

      <SectionLabel
        index="02"
        title="EXPORT"
        subtitle="导出全部 / 分表导出"
      />

      <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-6">
        <div className="mb-5">
          <Button
            variant="default"
            size="lg"
            disabled={working}
            onClick={exportAll}
            className="gap-2"
          >
            <FileSpreadsheet className="size-4" />
            导出全部 → 单个 .xlsx
          </Button>
        </div>
        <div className="border-t border-[var(--umx-line)] pt-5">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]">
            分表导出
          </div>
          <div className="space-y-2">
            {(Object.keys(TABLE_LABELS) as (keyof Bundle)[]).map((t) => (
              <div
                key={t}
                className="flex items-center justify-between border border-[var(--umx-line)] px-4 py-3"
              >
                <span className="font-mono text-[12px] text-[var(--umx-white)]">
                  {TABLE_LABELS[t]}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={working}
                    onClick={() => exportTable(t, "xlsx")}
                    className="gap-1.5"
                  >
                    <Download className="size-3" />
                    XLSX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={working}
                    onClick={() => exportTable(t, "csv")}
                    className="gap-1.5"
                  >
                    <Download className="size-3" />
                    CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionLabel
        index="03"
        title="GENERIC IMPORT"
        subtitle="通用导入 (CSV / Excel)"
      />

      <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-6">
        <p className="mb-5 max-w-2xl font-body text-sm leading-relaxed text-[var(--umx-silver)]">
          Excel：sheet 名要是 <code className="font-mono text-[11px] text-[var(--umx-acid)]">products / materials / boms / moves</code>
          ，列名要和数据库字段一致（一般是从此页导出再编辑后回传）。
          CSV：单文件单表，依靠表头自动识别。
          导入时 products/materials 按 code 覆盖、boms 按 (product_code, material_code) 覆盖、moves 追加写入。
        </p>
        <input
          ref={fileRefGeneric}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importGeneric(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="lg"
          disabled={working}
          onClick={() => fileRefGeneric.current?.click()}
          className="gap-2"
        >
          <Upload className="size-4" />
          选文件 → 通用导入
        </Button>
      </div>

      <SectionLabel index="04" title="LOG" subtitle="操作日志" />
      <div className="umx-scrollbar max-h-96 overflow-y-auto border border-[var(--umx-line)] bg-[var(--umx-bg-2)] p-4 font-mono text-[11px] leading-relaxed">
        {log.length === 0 ? (
          <span className="text-[var(--umx-text-dim)]">
            // 日志会在导入 / 导出过程中实时出现
          </span>
        ) : (
          log.map((line, i) => {
            const ok = line.includes("✓");
            const bad = line.includes("×");
            const color = ok
              ? "var(--umx-acid)"
              : bad
              ? "#ff6b6b"
              : "var(--umx-silver)";
            return (
              <div key={i} style={{ color }} className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                ) : bad ? (
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                ) : (
                  <span className="mt-0.5 size-3 shrink-0" />
                )}
                <span>{line}</span>
              </div>
            );
          })
        )}
      </div>

      {toastNode}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────── */

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v as string);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function dateTag(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function guessTableFromHeaders(headers: string[]): string | null {
  const h = headers.map((x) => x.toLowerCase());
  if (h.includes("product_code") && h.includes("material_code")) return "fin_boms";
  if (h.includes("kind") && h.includes("move_type")) return "fin_stock_moves";
  if (h.includes("unit_price")) return "fin_materials";
  if (h.includes("price") && h.includes("code") && h.includes("name"))
    return "fin_products";
  return null;
}
