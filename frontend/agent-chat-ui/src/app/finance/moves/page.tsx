"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Upload,
  Download,
  FileDown,
  Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  DataTable,
  FieldLabel,
  FinanceInput,
  FinanceSelect,
  FinanceTextarea,
  MATERIAL_IN_TYPES,
  MATERIAL_MOVE_TYPES,
  MATERIAL_OUT_TYPES,
  PLATFORMS,
  PRODUCT_IN_TYPES,
  PRODUCT_MOVE_TYPES,
  PRODUCT_OUT_TYPES,
  SearchableSelect,
  SectionLabel,
  useToast,
} from "../_components";
import { useAuth } from "@/providers/Auth";

type Move = {
  id: string;
  kind: "product" | "material";
  code: string;
  move_type: string;
  qty: number;
  unit_price: number | null;
  platform: string | null;
  customer: string | null;
  ref_product_code: string | null;
  is_repurchase: boolean | null;
  payment_date: string | null;
  note: string | null;
  occurred_at: string;
  created_at: string;
};

type Picker = { code: string; name: string };

const EMPTY: Partial<Move> = {
  kind: "product",
  code: "",
  move_type: "销售出库",
  qty: 1,
  unit_price: 0,
  platform: "",
  customer: "",
  ref_product_code: "",
  is_repurchase: false,
  payment_date: null,
  note: "",
  occurred_at: new Date().toISOString().slice(0, 16),
};

export default function FinanceMovesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Move[]>([]);
  const [products, setProducts] = useState<Picker[]>([]);
  const [materials, setMaterials] = useState<Picker[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindTab, setKindTab] = useState<"product" | "material">("product");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Move> | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toastNode } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // ─── Export to Excel ───
  const handleExport = async () => {
    const { data, error } = await supabase
      .from("fin_stock_moves")
      .select("*")
      .order("occurred_at", { ascending: false });
    if (error || !data) {
      show("err", `导出失败：${error?.message ?? "无数据"}`);
      return;
    }
    if (data.length === 0) {
      show("err", "表中无内容可导出");
      return;
    }
    const fname = `stock_moves_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "moves");
    XLSX.writeFile(wb, fname);
    show("ok", `已成功导出 ${data.length} 条记录`);
  };

  // ─── Download Template ───
  const handleDownloadTemplate = () => {
    const headers = [
      "kind",
      "code",
      "move_type",
      "qty",
      "unit_price",
      "platform",
      "customer",
      "ref_product_code",
      "is_repurchase",
      "payment_date",
      "occurred_at",
      "note"
    ];
    const csv = headers.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_moves_template.csv";
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
        const text = await file.text();
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
          kind: String(item.kind || "product").trim(),
          code: String(item.code || "").trim(),
          move_type: String(item.move_type || "").trim(),
          qty: item.qty === null || item.qty === undefined || item.qty === "" ? 1 : Number(item.qty),
          unit_price: item.unit_price === null || item.unit_price === undefined || item.unit_price === "" ? null : Number(item.unit_price),
          platform: item.platform ? String(item.platform).trim() : null,
          customer: (item.customer || item.supplier) ? String(item.customer || item.supplier).trim() : null,
          ref_product_code: item.ref_product_code ? String(item.ref_product_code).trim() : null,
          is_repurchase: item.is_repurchase === "true" || item.is_repurchase === "1" || item.is_repurchase === true,
          payment_date: item.payment_date ? String(item.payment_date).trim() : null,
          occurred_at: item.occurred_at ? new Date(item.occurred_at).toISOString() : new Date().toISOString(),
          note: item.note ? String(item.note).trim() : null,
          created_by: user?.id,
        };
      }).filter((r) => r.code && r.move_type && r.qty);

      if (cleaned.length === 0) {
        show("err", "没有找到有效的流水行，确保包含 code、move_type 和 qty 列");
        return;
      }

      const { error } = await supabase
        .from("fin_stock_moves")
        .insert(cleaned);

      if (error) {
        show("err", `导入失败：${error.message}`);
      } else {
        show("ok", `成功导入 ${cleaned.length} 条流水`);
        fetchAll();
      }
    } catch (err: any) {
      show("err", `解析出错：${err?.message || err}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [mv, p, m] = await Promise.all([
      supabase
        .from("fin_stock_moves")
        .select("*")
        .order("occurred_at", { ascending: false }),
      supabase.from("fin_products").select("code,name").order("code"),
      supabase.from("fin_materials").select("code,name").order("code"),
    ]);
    if (mv.data) setRows(mv.data as Move[]);
    if (p.data) setProducts(p.data as Picker[]);
    if (m.data) setMaterials(m.data as Picker[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const productMap = useMemo(
    () => Object.fromEntries(products.map((x) => [x.code, x.name])),
    [products],
  );
  const materialMap = useMemo(
    () => Object.fromEntries(materials.map((x) => [x.code, x.name])),
    [materials],
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` })),
    [products]
  );
  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` })),
    [materials]
  );

  const searchableCodeOptions = useMemo(() => {
    return editing?.kind === "material" ? materialOptions : productOptions;
  }, [editing?.kind, materialOptions, productOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.kind !== kindTab) return false;
      if (typeFilter !== "all" && r.move_type !== typeFilter) return false;

      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (new Date(r.occurred_at) < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (new Date(r.occurred_at) > eDate) return false;
      }

      if (minQty && Number(r.qty) < Number(minQty)) return false;
      if (maxQty && Number(r.qty) > Number(maxQty)) return false;

      if (minPrice && (r.unit_price === null || Number(r.unit_price) < Number(minPrice))) return false;
      if (maxPrice && (r.unit_price === null || Number(r.unit_price) > Number(maxPrice))) return false;

      if (kindTab === "product" && platformFilter !== "all" && r.platform !== platformFilter) return false;

      if (q) {
        const hay = `${r.code} ${productMap[r.code] ?? ""} ${materialMap[r.code] ?? ""} ${r.customer ?? ""} ${r.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, kindTab, typeFilter, startDate, endDate, minQty, maxQty, minPrice, maxPrice, platformFilter, query, productMap, materialMap]);



  const startNew = () =>
    setEditing({
      ...EMPTY,
      kind: kindTab,
      move_type: kindTab === "material" ? "采购入库" : "销售出库",
      occurred_at: new Date().toISOString().slice(0, 16),
    });

  const startEdit = (r: Move) =>
    setEditing({
      ...r,
      occurred_at: r.occurred_at
        ? new Date(r.occurred_at).toISOString().slice(0, 16)
        : "",
    });

  const cancel = () => setEditing(null);

  const isInbound =
    editing?.kind === "material"
      ? (MATERIAL_IN_TYPES as readonly string[]).includes(editing.move_type ?? "")
      : (PRODUCT_IN_TYPES as readonly string[]).includes(editing?.move_type ?? "");

  const save = async () => {
    if (!editing) return;
    if (!editing.code) {
      show("err", "请选择编号");
      return;
    }
    if (!editing.move_type) {
      show("err", "请选择类型");
      return;
    }
    if (!Number(editing.qty)) {
      show("err", "数量必须 > 0");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      kind: editing.kind,
      code: editing.code,
      move_type: editing.move_type,
      qty: Number(editing.qty),
      unit_price: editing.unit_price ? Number(editing.unit_price) : null,
      platform: editing.platform || null,
      customer: editing.customer || null,
      ref_product_code: editing.ref_product_code || null,
      is_repurchase: !!editing.is_repurchase,
      payment_date: editing.payment_date || null,
      note: editing.note?.trim() || null,
      occurred_at: editing.occurred_at
        ? new Date(editing.occurred_at as string).toISOString()
        : new Date().toISOString(),
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("fin_stock_moves")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("fin_stock_moves")
        .insert({ ...payload, created_by: user?.id }));
    }
    setSaving(false);
    if (error) {
      show("err", `保存失败：${error.message}`);
      return;
    }
    show("ok", editing.id ? "已更新" : "已新建");
    setEditing(null);
    fetchAll();
  };

  const remove = async (r: Move) => {
    if (!confirm(`确认删除该流水：${r.move_type} · ${r.code} × ${r.qty}？`))
      return;
    const { error } = await supabase
      .from("fin_stock_moves")
      .delete()
      .eq("id", r.id);
    if (error) show("err", `删除失败：${error.message}`);
    else {
      show("ok", "已删除");
      fetchAll();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SectionLabel
        index="01"
        title="出入库流水"
        subtitle="成品与原材料进出库明细历史记录"
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
              onClick={fetchAll}
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
              新建流水
            </Button>
          </>
        }
      />

      {/* kind tabs */}
      <div className="flex border-b border-[var(--umx-line)]">
        {(["product", "material"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKindTab(k);
              setTypeFilter("all");
            }}
            className={`relative flex h-10 items-center px-5 font-mono text-[11px] uppercase tracking-[0.18em] ${
              kindTab === k
                ? "text-[var(--umx-acid)]"
                : "text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]"
            }`}
          >
            {k === "product" ? "成品出入库流水" : "原料出入库流水"}
            {kindTab === k && (
              <span className="absolute inset-x-3 -bottom-px h-px bg-[var(--umx-acid)]" />
            )}
          </button>
        ))}
      </div>

      {/* 编辑表单 */}
      {editing && (
        <div className="border border-[var(--umx-acid)] bg-[var(--umx-bg-1)] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="m-0 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-[var(--umx-acid)]">
              {isInbound ? (
                <ArrowDownToLine className="size-3.5" />
              ) : (
                <ArrowUpFromLine className="size-3.5" />
              )}
              {editing.id ? "编辑流水" : "新建流水"}
            </h3>
            <button
              onClick={cancel}
              className="text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <FieldLabel required>物料类别</FieldLabel>
              <FinanceSelect
                value={editing.kind ?? "product"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    kind: e.target.value as "product" | "material",
                    code: "",
                    move_type:
                      e.target.value === "material" ? "采购入库" : "销售出库",
                  })
                }
                disabled={!!editing.id}
              >
                <option value="product">成品</option>
                <option value="material">原料</option>
              </FinanceSelect>
            </div>
            <div>
              <FieldLabel required>变动动作</FieldLabel>
              <FinanceSelect
                value={editing.move_type ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, move_type: e.target.value })
                }
              >
                <optgroup label="入库">
                  {(editing.kind === "material"
                    ? MATERIAL_IN_TYPES
                    : PRODUCT_IN_TYPES
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="出库">
                  {(editing.kind === "material"
                    ? MATERIAL_OUT_TYPES
                    : PRODUCT_OUT_TYPES
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>
              </FinanceSelect>
            </div>
            <div className="md:col-span-2">
              <FieldLabel required>
                {editing.kind === "material" ? "选择原料" : "选择成品"}
              </FieldLabel>
              <SearchableSelect
                options={searchableCodeOptions}
                value={editing.code ?? ""}
                onChange={(val) => setEditing({ ...editing, code: val })}
                placeholder={editing.kind === "material" ? "— 请选择原料 —" : "— 请选择成品 —"}
              />
            </div>
            <div>
              <FieldLabel required>变动数量</FieldLabel>
              <FinanceInput
                type="number"
                step="0.0001"
                value={String(editing.qty ?? 0)}
                onChange={(e) =>
                  setEditing({ ...editing, qty: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <FieldLabel>单价</FieldLabel>
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
            <div className="md:col-span-2">
              <FieldLabel>发生时间</FieldLabel>
              <FinanceInput
                type="datetime-local"
                value={(editing.occurred_at as string) ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, occurred_at: e.target.value })
                }
              />
            </div>

            {/* 成品销售相关字段 */}
            {editing.kind === "product" &&
              (editing.move_type === "销售出库" ||
                editing.move_type === "退货入库") && (
                <>
                  <div>
                    <FieldLabel>销售平台</FieldLabel>
                    <FinanceSelect
                      value={editing.platform ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, platform: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </FinanceSelect>
                  </div>
                  <div>
                    <FieldLabel>往来客户</FieldLabel>
                    <FinanceInput
                      value={editing.customer ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, customer: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>回款日期</FieldLabel>
                    <FinanceInput
                      type="date"
                      value={editing.payment_date ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          payment_date: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex h-9 cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--umx-silver)]">
                      <input
                        type="checkbox"
                        checked={!!editing.is_repurchase}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            is_repurchase: e.target.checked,
                          })
                        }
                        className="accent-[var(--umx-acid)]"
                      />
                      回购客户
                    </label>
                  </div>
                </>
              )}

            {/* 原料生产领料：关联成品 */}
            {editing.kind === "material" &&
              editing.move_type === "生产领料" && (
                <div className="md:col-span-2">
                  <FieldLabel>对应成品</FieldLabel>
                  <SearchableSelect
                    options={productOptions}
                    value={editing.ref_product_code ?? ""}
                    onChange={(val) =>
                      setEditing({
                        ...editing,
                        ref_product_code: val || null,
                      })
                    }
                    placeholder="— 请选择成品 —"
                  />
                </div>
              )}

            {/* 原料采购入库：关联供应商 */}
            {editing.kind === "material" &&
              editing.move_type === "采购入库" && (
                <div className="md:col-span-2">
                  <FieldLabel>供应商</FieldLabel>
                  <FinanceInput
                    value={editing.customer ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, customer: e.target.value })
                    }
                    placeholder="请输入供应商名称，如：宏达材料厂"
                  />
                </div>
              )}

            <div className="md:col-span-4">
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

      {/* 筛选 + 表 */}
      <div>
        <div className="mb-4 border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
              <FinanceInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入编号 / 名称 / 客户 / 备注进行筛选..."
                className="h-9 w-64 pl-7"
              />
            </div>
            <FinanceSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-36"
            >
              <option value="all">全部动作</option>
              {(kindTab === "material" ? MATERIAL_MOVE_TYPES : PRODUCT_MOVE_TYPES).map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </FinanceSelect>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">时间</span>
              <FinanceInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-36"
              />
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">至</span>
              <FinanceInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-36"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--umx-line)]/30 pt-3">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">数量区间</span>
              <FinanceInput
                type="number"
                placeholder="最小"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                className="h-9 w-20"
              />
              <span className="text-[var(--umx-text-dim)]">-</span>
              <FinanceInput
                type="number"
                placeholder="最大"
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                className="h-9 w-20"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">单价区间</span>
              <FinanceInput
                type="number"
                placeholder="最小"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-9 w-20"
              />
              <span className="text-[var(--umx-text-dim)]">-</span>
              <FinanceInput
                type="number"
                placeholder="最大"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-9 w-20"
              />
            </div>
            {kindTab === "product" && (
              <FinanceSelect
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-32"
              >
                <option value="all">全部平台</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </FinanceSelect>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
                setStartDate("");
                setEndDate("");
                setMinQty("");
                setMaxQty("");
                setMinPrice("");
                setMaxPrice("");
                setPlatformFilter("all");
              }}
              className="h-9 gap-1 text-[var(--umx-text-dim)] border-[var(--umx-line)] hover:text-[var(--umx-white)]"
            >
              重置
            </Button>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
              {filtered.length} / {rows.filter((r) => r.kind === kindTab).length} 条
            </span>
          </div>
        </div>

        <DataTable
          rows={filtered}
          empty={loading ? "正在加载数据..." : "尚无流水记录"}
          columns={[
            {
              key: "time",
              header: "发生时间",
              width: "170px",
              render: (r) => (
                <span className="font-mono text-[11px] text-[var(--umx-silver)]">
                  {r.occurred_at
                    ? new Date(r.occurred_at).toLocaleString("zh-CN", {
                        hour12: false,
                      })
                    : "—"}
                </span>
              ),
            },
            {
              key: "type",
              header: "出入库动作",
              width: "140px",
              render: (r) => {
                const inbound =
                  r.kind === "material"
                    ? (MATERIAL_IN_TYPES as readonly string[]).includes(r.move_type)
                    : (PRODUCT_IN_TYPES as readonly string[]).includes(r.move_type);
                return (
                  <span
                    className="border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                    style={{
                      borderColor: inbound ? "var(--umx-acid)" : "var(--umx-violet)",
                      color: inbound ? "var(--umx-acid)" : "var(--umx-violet)",
                    }}
                  >
                    {r.move_type}
                  </span>
                );
              },
            },
            {
              key: "code",
              header: "物料信息",
              render: (r) => (
                <span className="font-mono text-[12px]">
                  <span>{r.code}</span>
                  <span className="ml-2 text-[var(--umx-silver)]">
                    {r.kind === "material"
                      ? materialMap[r.code] ?? ""
                      : productMap[r.code] ?? ""}
                  </span>
                </span>
              ),
            },
            {
              key: "qty",
              header: "变动数量",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[13px] font-bold">
                  {fmt(r.qty)}
                </span>
              ),
            },
            {
              key: "price",
              header: "单价",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {r.unit_price ? fmt(r.unit_price) : "—"}
                </span>
              ),
            },
            {
              key: "amount",
              header: "总金额",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-silver)]">
                  {r.unit_price ? fmt(Number(r.qty) * Number(r.unit_price)) : "—"}
                </span>
              ),
            },
            {
              key: "ctx",
              header: "往来单位与平台",
              render: (r) => (
                <span className="text-[12px] text-[var(--umx-silver)]">
                  {r.kind === "material" ? (
                    [
                      r.customer ? `供应商: ${r.customer}` : null,
                      r.ref_product_code ? `关联成品: ${r.ref_product_code}` : null
                    ].filter(Boolean).join(" · ") || "—"
                  ) : (
                    [
                      r.platform ? `平台: ${r.platform}` : null,
                      r.customer ? `客户: ${r.customer}` : null
                    ].filter(Boolean).join(" · ") || "—"
                  )}
                  {r.is_repurchase && (
                    <span className="ml-2 border border-[var(--umx-acid)] px-1 font-mono text-[9px] uppercase text-[var(--umx-acid)]">
                      回购
                    </span>
                  )}
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
              header: "OPS",
              width: "100px",
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
