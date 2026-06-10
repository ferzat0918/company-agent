"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, X, Save, Search, RefreshCw, Upload, Download, FileDown, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { readCsvText } from "@/lib/decode-csv";
import {
  DataTable,
  FieldLabel,
  FinanceInput,
  FinanceSelect,
  FinanceTextarea,
  SectionLabel,
  useToast,
} from "../_components";
import { useAuth } from "@/providers/Auth";

type Material = {
  id: string;
  code: string;
  name: string;
  unit_price: number | null;
  min_stock: number | null;
  max_stock: number | null;
  note: string | null;
  created_at: string;
};

const EMPTY: Partial<Material> = {
  code: "",
  name: "",
  unit_price: 0,
  min_stock: 0,
  max_stock: 0,
  note: "",
};

export default function FinanceMaterialsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [alertConfigFilter, setAlertConfigFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Material> | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toastNode } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // ─── Export to Excel ───
  const handleExport = async () => {
    const { data, error } = await supabase
      .from("fin_materials")
      .select("*")
      .order("code");
    if (error || !data) {
      show("err", `导出失败：${error?.message ?? "无数据"}`);
      return;
    }
    if (data.length === 0) {
      show("err", "表中无内容可导出");
      return;
    }
    const fname = `materials_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "materials");
    XLSX.writeFile(wb, fname);
    show("ok", `已成功导出 ${data.length} 条记录`);
  };

  // ─── Download Template ───
  const handleDownloadTemplate = () => {
    const headers = ["code", "name", "unit_price", "min_stock", "max_stock", "note"];
    const csv = headers.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "materials_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    show("ok", "模板下载成功");
  };

  // ─── Import from file ───
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      let importedRows: any[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await readCsvText(file);
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        importedRows = parsed.data;
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        importedRows = XLSX.utils.sheet_to_json(ws, { defval: null });
      }

      if (importedRows.length === 0) {
        show("err", "文件为空或未解析到有效数据");
        return;
      }

      // Validating and cleaning data
      const cleaned = importedRows.map((r) => {
        const item: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          if (v === "" || v === undefined || v === null) continue;
          item[k] = v;
        }
        return {
          code: String(item.code || "").trim(),
          name: String(item.name || "").trim(),
          unit_price: item.unit_price === null || item.unit_price === undefined || item.unit_price === "" ? null : Number(item.unit_price),
          min_stock: item.min_stock === null || item.min_stock === undefined || item.min_stock === "" ? null : Number(item.min_stock),
          max_stock: item.max_stock === null || item.max_stock === undefined || item.max_stock === "" ? null : Number(item.max_stock),
          note: item.note ? String(item.note).trim() : null,
          created_by: user?.id,
          updated_at: new Date().toISOString()
        };
      }).filter((r) => r.code && r.name);

      if (cleaned.length === 0) {
        show("err", "没有找到有效的原料行，确保包含 code 和 name 列");
        return;
      }

      const { error } = await supabase
        .from("fin_materials")
        .upsert(cleaned, { onConflict: "code" });

      if (error) {
        show("err", `导入失败：${error.message}`);
      } else {
        show("ok", `成功导入 ${cleaned.length} 条原料`);
        fetchData();
      }
    } catch (err: any) {
      show("err", `解析出错：${err?.message || err}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fin_materials")
      .select("*")
      .order("code");
    if (!error && data) setRows(data as Material[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (minPrice && (r.unit_price === null || Number(r.unit_price) < Number(minPrice))) return false;
      if (maxPrice && (r.unit_price === null || Number(r.unit_price) > Number(maxPrice))) return false;
      if (alertConfigFilter === "configured") {
        if (!r.min_stock && !r.max_stock) return false;
      } else if (alertConfigFilter === "none") {
        if (r.min_stock || r.max_stock) return false;
      }
      if (q) {
        const hay = `${r.code} ${r.name} ${r.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, minPrice, maxPrice, alertConfigFilter, query]);

  const startNew = () => setEditing({ ...EMPTY });
  const startEdit = (r: Material) => setEditing({ ...r });
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    if (!editing.code?.trim() || !editing.name?.trim()) {
      show("err", "编号和名称不能为空");
      return;
    }
    setSaving(true);
    const payload = {
      code: editing.code.trim(),
      name: editing.name.trim(),
      unit_price: Number(editing.unit_price) || 0,
      min_stock: Number(editing.min_stock) || 0,
      max_stock: Number(editing.max_stock) || 0,
      note: editing.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("fin_materials")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("fin_materials")
        .insert({ ...payload, created_by: user?.id }));
    }
    setSaving(false);
    if (error) {
      show("err", `保存失败：${error.message}`);
      return;
    }
    show("ok", editing.id ? "已更新" : "已新建");
    setEditing(null);
    fetchData();
  };

  const remove = async (r: Material) => {
    if (!confirm(`确认删除原料 ${r.code} ${r.name}？流水将保留。`)) return;
    const { error } = await supabase
      .from("fin_materials")
      .delete()
      .eq("id", r.id);
    if (error) show("err", `删除失败：${error.message}`);
    else {
      show("ok", "已删除");
      fetchData();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SectionLabel
        index="01"
        title="原料档案"
        subtitle="原材料数据与采购价管理"
        right={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5"
            >
              <FileDown className="size-3" />
              模板
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5"
            >
              {importing ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              导入
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="size-3" />
              导出
            </Button>
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
            <Button
              variant="acid"
              size="sm"
              onClick={startNew}
              disabled={!!editing}
              className="gap-1.5"
            >
              <Plus className="size-3" />
              新建原料
            </Button>
          </>
        }
      />

      {editing && (
        <div className="border border-[var(--umx-acid)] bg-[var(--umx-bg-1)] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="m-0 font-display text-sm font-bold uppercase tracking-[0.14em] text-[var(--umx-acid)]">
              {editing.id ? "编辑原料" : "新建原料"} ·{" "}
              {editing.code || "(未填编号)"}
            </h3>
            <button
              onClick={cancel}
              className="text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <FieldLabel required>原料编号</FieldLabel>
              <FinanceInput
                value={editing.code ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, code: e.target.value })
                }
                placeholder="例：YL1001"
                disabled={!!editing.id}
              />
            </div>
            <div>
              <FieldLabel required>原料名称</FieldLabel>
              <FinanceInput
                value={editing.name ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="例：钢板 3mm"
              />
            </div>
            <div>
              <FieldLabel>采购单价</FieldLabel>
              <FinanceInput
                type="number"
                step="0.01"
                value={String(editing.unit_price ?? 0)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    unit_price: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <FieldLabel>最低库存预警</FieldLabel>
              <FinanceInput
                type="number"
                step="0.01"
                value={String(editing.min_stock ?? 0)}
                onChange={(e) =>
                  setEditing({ ...editing, min_stock: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <FieldLabel>最高库存预警</FieldLabel>
              <FinanceInput
                type="number"
                step="0.01"
                value={String(editing.max_stock ?? 0)}
                onChange={(e) =>
                  setEditing({ ...editing, max_stock: Number(e.target.value) })
                }
              />
            </div>
            <div className="md:col-span-3">
              <FieldLabel>备注</FieldLabel>
              <FinanceTextarea
                value={editing.note ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, note: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel}>
              取消
            </Button>
            <Button
              variant="acid"
              size="sm"
              onClick={save}
              disabled={saving}
              className="gap-1.5"
            >
              <Save className="size-3" />
              {saving ? "正在保存..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-4 border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
              <FinanceInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入编号 / 名称 / 备注进行筛选..."
                className="h-9 w-64 pl-7"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">单价区间</span>
              <FinanceInput
                type="number"
                placeholder="最小"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-9 w-24"
              />
              <span className="text-[var(--umx-text-dim)]">-</span>
              <FinanceInput
                type="number"
                placeholder="最大"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-9 w-24"
              />
            </div>
            <FinanceSelect
              value={alertConfigFilter}
              onChange={(e) => setAlertConfigFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">全部预警配置</option>
              <option value="configured">已配置预警上下限</option>
              <option value="none">未配置预警上下限</option>
            </FinanceSelect>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setMinPrice("");
                setMaxPrice("");
                setAlertConfigFilter("all");
              }}
              className="h-9 gap-1 text-[var(--umx-text-dim)] border-[var(--umx-line)] hover:text-[var(--umx-white)]"
            >
              重置
            </Button>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
              已筛选 {filtered.length} / {rows.length} 条
            </span>
          </div>
        </div>

        <DataTable
          rows={filtered}
          empty={loading ? "正在加载数据..." : "尚无原料，点击右上角「新建原料」"}
          columns={[
            {
              key: "code",
              header: "原料编号",
              width: "140px",
              render: (r) => (
                <span className="font-mono text-[12px]">{r.code}</span>
              ),
            },
            { key: "name", header: "原料名称", render: (r) => r.name },
            {
              key: "price",
              header: "采购单价",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px]">{fmt(r.unit_price)}</span>
              ),
            },
            {
              key: "min",
              header: "最低预警",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {fmt(r.min_stock)}
                </span>
              ),
            },
            {
              key: "max",
              header: "最高预警",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {fmt(r.max_stock)}
                </span>
              ),
            },
            {
              key: "note",
              header: "备注",
              render: (r) => (
                <span className="text-[12px] text-[var(--umx-silver)]">
                  {r.note || "—"}
                </span>
              ),
            },
            {
              key: "ops",
              header: "操作",
              width: "120px",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => startEdit(r)}
                    className="text-[var(--umx-text-dim)] hover:text-[var(--umx-acid)]"
                    title="编辑"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="text-[var(--umx-text-dim)] hover:text-[#ff6b6b]"
                    title="删除"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {toastNode}
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
