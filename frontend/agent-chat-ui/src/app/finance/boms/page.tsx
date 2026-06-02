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
  PackageOpen,
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
  SearchableSelect,
  SectionLabel,
  useToast,
} from "../_components";

type Bom = {
  id: string;
  product_code: string;
  material_code: string;
  qty: number;
  loss_rate: number;
  note: string | null;
  created_at: string;
};

type Picker = { code: string; name: string };



export default function FinanceBomsPage() {
  const [rows, setRows] = useState<Bom[]>([]);
  const [products, setProducts] = useState<Picker[]>([]);
  const [materials, setMaterials] = useState<Picker[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [minLoss, setMinLoss] = useState("");
  const [maxLoss, setMaxLoss] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<(Partial<Bom> & { items?: any[] }) | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toastNode } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // ─── Export to Excel ───
  const handleExport = async () => {
    const { data, error } = await supabase
      .from("fin_boms")
      .select("*")
      .order("product_code")
      .order("material_code");
    if (error || !data) {
      show("err", `导出失败：${error?.message ?? "无数据"}`);
      return;
    }
    if (data.length === 0) {
      show("err", "表中无内容可导出");
      return;
    }
    const fname = `boms_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "boms");
    XLSX.writeFile(wb, fname);
    show("ok", `已成功导出 ${data.length} 条记录`);
  };

  // ─── Download Template ───
  const handleDownloadTemplate = () => {
    const headers = ["product_code", "material_code", "qty", "loss_rate", "note"];
    const csv = headers.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boms_template.csv";
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
          product_code: String(item.product_code || "").trim(),
          material_code: String(item.material_code || "").trim(),
          qty: item.qty === null || item.qty === undefined || item.qty === "" ? 1 : Number(item.qty),
          loss_rate: item.loss_rate === null || item.loss_rate === undefined || item.loss_rate === "" ? 0 : Number(item.loss_rate),
          note: item.note ? String(item.note).trim() : null,
        };
      }).filter((r) => r.product_code && r.material_code);

      if (cleaned.length === 0) {
        show("err", "没有找到有效的配方行，确保包含 product_code 和 material_code 列");
        return;
      }

      const { error } = await supabase
        .from("fin_boms")
        .upsert(cleaned, { onConflict: "product_code,material_code" });

      if (error) {
        show("err", `导入失败：${error.message}`);
      } else {
        show("ok", `成功导入 ${cleaned.length} 条配方`);
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
    const [b, p, m] = await Promise.all([
      supabase.from("fin_boms").select("*").order("product_code").order("material_code"),
      supabase.from("fin_products").select("code,name").order("code"),
      supabase.from("fin_materials").select("code,name").order("code"),
    ]);
    if (b.data) setRows(b.data as Bom[]);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (productFilter !== "all" && r.product_code !== productFilter) return false;
      if (materialFilter !== "all" && r.material_code !== materialFilter) return false;
      if (minQty && Number(r.qty) < Number(minQty)) return false;
      if (maxQty && Number(r.qty) > Number(maxQty)) return false;
      if (minLoss && Number(r.loss_rate) < Number(minLoss)) return false;
      if (maxLoss && Number(r.loss_rate) > Number(maxLoss)) return false;
      if (q) {
        const hay = `${r.product_code} ${r.material_code} ${productMap[r.product_code] ?? ""} ${materialMap[r.material_code] ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, productFilter, materialFilter, minQty, maxQty, minLoss, maxLoss, query, productMap, materialMap]);

  const startNew = () =>
    setEditing({
      product_code: "",
      items: [{ material_code: "", qty: 1, loss_rate: 0, note: "" }],
    });
  const startEdit = (r: Bom) => setEditing({ ...r });
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    if (!editing.product_code) {
      show("err", "请选择对应成品");
      return;
    }

    setSaving(true);
    let error;

    if (editing.id) {
      // ─── 单品编辑模式 ───
      if (!editing.material_code) {
        show("err", "请选择原料");
        setSaving(false);
        return;
      }
      const payload = {
        product_code: editing.product_code,
        material_code: editing.material_code,
        qty: Number(editing.qty) || 0,
        loss_rate: Number(editing.loss_rate) || 0,
        note: editing.note?.trim() || null,
      };
      ({ error } = await supabase
        .from("fin_boms")
        .update(payload)
        .eq("id", editing.id));
    } else {
      // ─── 多原料批量新增模式 ───
      const items = editing.items ?? [];
      const validItems = items.filter(
        (item) => item.material_code && Number(item.qty) > 0,
      );

      if (validItems.length === 0) {
        show("err", "请至少添加一行完整的原料并填写数量");
        setSaving(false);
        return;
      }

      // 查重：同一个表单提交中是否有重复的原料
      const seen = new Set();
      for (const item of validItems) {
        if (seen.has(item.material_code)) {
          show("err", `原料清单中包含重复的原料: ${item.material_code}`);
          setSaving(false);
          return;
        }
        seen.add(item.material_code);
      }

      const payloads = validItems.map((item) => ({
        product_code: editing.product_code,
        material_code: item.material_code,
        qty: Number(item.qty) || 0,
        loss_rate: Number(item.loss_rate) || 0,
        note: item.note?.trim() || null,
      }));

      ({ error } = await supabase
        .from("fin_boms")
        .upsert(payloads, { onConflict: "product_code,material_code" }));
    }

    setSaving(false);
    if (error) {
      show(
        "err",
        error.code === "23505"
          ? "部分成品+原料组合已存在，请检查"
          : `保存失败：${error.message}`,
      );
      return;
    }
    show("ok", editing.id ? "已更新" : "新建配方成功");
    setEditing(null);
    fetchAll();
  };

  const remove = async (r: Bom) => {
    if (
      !confirm(
        `确认删除配方：${r.product_code} ← ${r.material_code} × ${r.qty}？`,
      )
    )
      return;
    const { error } = await supabase.from("fin_boms").delete().eq("id", r.id);
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
        title="BOM 配方"
        subtitle="成品生产所需原材料配比清单"
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
              新建配方
            </Button>
          </>
        }
      />

      {editing && (
        <div className="border border-[var(--umx-acid)] bg-[var(--umx-bg-1)] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="m-0 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-[var(--umx-acid)]">
              <PackageOpen className="size-3.5" />
              {editing.id ? "编辑配方" : "新建配方"}
            </h3>
            <button
              onClick={cancel}
              className="text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]"
            >
              <X className="size-4" />
            </button>
          </div>
          {editing.id ? (
            // ─── 单品编辑模式 ───
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <FieldLabel required>对应成品</FieldLabel>
                <SearchableSelect
                  options={productOptions}
                  value={editing.product_code ?? ""}
                  onChange={(val) =>
                    setEditing({ ...editing, product_code: val })
                  }
                  disabled={!!editing.id}
                  placeholder="— 请选择成品 —"
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>所需原料</FieldLabel>
                <SearchableSelect
                  options={materialOptions}
                  value={editing.material_code ?? ""}
                  onChange={(val) =>
                    setEditing({ ...editing, material_code: val })
                  }
                  disabled={!!editing.id}
                  placeholder="— 请选择原料 —"
                />
              </div>
              <div>
                <FieldLabel required>单件用量</FieldLabel>
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
                <FieldLabel>预计损耗率 (如 0.05 表示 5%)</FieldLabel>
                <FinanceInput
                  type="number"
                  step="0.001"
                  value={String(editing.loss_rate ?? 0)}
                  onChange={(e) =>
                    setEditing({ ...editing, loss_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>备注</FieldLabel>
                <FinanceTextarea
                  value={editing.note ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                />
              </div>
            </div>
          ) : (
            // ─── 多原料批量新增模式 ───
            <div className="space-y-6">
              <div className="max-w-md">
                <FieldLabel required>对应成品</FieldLabel>
                <SearchableSelect
                  options={productOptions}
                  value={editing.product_code ?? ""}
                  onChange={(val) =>
                    setEditing({ ...editing, product_code: val })
                  }
                  placeholder="— 请选择成品 —"
                />
              </div>

              <div className="border-t border-[var(--umx-line)] pt-5">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--umx-text-dim)]">
                  配方原料清单明细
                </div>
                <div className="space-y-3">
                  {editing.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative grid grid-cols-1 gap-4 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] p-4 md:grid-cols-12 md:items-end"
                    >
                      <div className="md:col-span-3">
                        <FieldLabel required>所需原料</FieldLabel>
                        <SearchableSelect
                          options={materialOptions}
                          value={item.material_code}
                          onChange={(val) => {
                            const newItems = [...(editing.items ?? [])];
                            newItems[idx] = {
                              ...item,
                              material_code: val,
                            };
                            setEditing({ ...editing, items: newItems });
                          }}
                          placeholder="— 请选择原料 —"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FieldLabel required>单件用量</FieldLabel>
                        <FinanceInput
                          type="number"
                          step="0.0001"
                          value={String(item.qty)}
                          onChange={(e) => {
                            const newItems = [...(editing.items ?? [])];
                            newItems[idx] = {
                              ...item,
                              qty: Number(e.target.value),
                            };
                            setEditing({ ...editing, items: newItems });
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FieldLabel>预计损耗率</FieldLabel>
                        <FinanceInput
                          type="number"
                          step="0.001"
                          value={String(item.loss_rate)}
                          onChange={(e) => {
                            const newItems = [...(editing.items ?? [])];
                            newItems[idx] = {
                              ...item,
                              loss_rate: Number(e.target.value),
                            };
                            setEditing({ ...editing, items: newItems });
                          }}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <FieldLabel>备注</FieldLabel>
                        <FinanceInput
                          value={item.note}
                          onChange={(e) => {
                            const newItems = [...(editing.items ?? [])];
                            newItems[idx] = { ...item, note: e.target.value };
                            setEditing({ ...editing, items: newItems });
                          }}
                          placeholder="备注说明 (选填)"
                        />
                      </div>
                      <div className="flex md:col-span-1 md:justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newItems = (editing.items ?? []).filter(
                              (_, i) => i !== idx,
                            );
                            setEditing({ ...editing, items: newItems });
                          }}
                          disabled={(editing.items ?? []).length <= 1}
                          className="h-9 w-full p-0 text-[#ff6b6b] border-[#ff6b6b]/30 hover:bg-[#ff6b6b]/10 md:w-9 flex items-center justify-center"
                          title="移除此行"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItems = [
                        ...(editing.items ?? []),
                        { material_code: "", qty: 1, loss_rate: 0, note: "" },
                      ];
                      setEditing({ ...editing, items: newItems });
                    }}
                    className="gap-1.5 border-[var(--umx-acid)]/30 text-[var(--umx-acid)] hover:bg-[var(--umx-acid)]/10"
                  >
                    <Plus className="size-3.5" />
                    添加原料行
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2 border-t border-[var(--umx-line)] pt-4">
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
                placeholder="输入成品 / 原料 / 编号进行筛选..."
                className="h-9 w-64 pl-7"
              />
            </div>
            <FinanceSelect
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">全部成品</option>
              {products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.name}
                </option>
              ))}
            </FinanceSelect>
            <FinanceSelect
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">全部原料</option>
              {materials.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} · {m.name}
                </option>
              ))}
            </FinanceSelect>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--umx-line)]/30 pt-3">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">单件用量</span>
              <FinanceInput
                type="number"
                placeholder="最小"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                className="h-9 w-24"
              />
              <span className="text-[var(--umx-text-dim)]">-</span>
              <FinanceInput
                type="number"
                placeholder="最大"
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                className="h-9 w-24"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--umx-text-dim)]">损耗率范围</span>
              <FinanceInput
                type="number"
                step="0.01"
                placeholder="最小 (如 0.05)"
                value={minLoss}
                onChange={(e) => setMinLoss(e.target.value)}
                className="h-9 w-32"
              />
              <span className="text-[var(--umx-text-dim)]">-</span>
              <FinanceInput
                type="number"
                step="0.01"
                placeholder="最大 (如 0.10)"
                value={maxLoss}
                onChange={(e) => setMaxLoss(e.target.value)}
                className="h-9 w-32"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setProductFilter("all");
                setMaterialFilter("all");
                setMinQty("");
                setMaxQty("");
                setMinLoss("");
                setMaxLoss("");
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
          empty={
            loading ? "正在加载数据..." : "尚无配方，点击右上角「新建配方」"
          }
          columns={[
            {
              key: "p_code",
              header: "对应成品",
              render: (r) => (
                <span className="font-mono text-[12px]">
                  <span className="text-[var(--umx-acid)]">{r.product_code}</span>
                  <span className="ml-2 text-[var(--umx-silver)]">
                    {productMap[r.product_code] ?? "—"}
                  </span>
                </span>
              ),
            },
            {
              key: "m_code",
              header: "所需原料",
              render: (r) => (
                <span className="font-mono text-[12px]">
                  <span className="text-[var(--umx-violet)]">{r.material_code}</span>
                  <span className="ml-2 text-[var(--umx-silver)]">
                    {materialMap[r.material_code] ?? "—"}
                  </span>
                </span>
              ),
            },
            {
              key: "qty",
              header: "单件用量",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[13px] font-bold">
                  {fmt(r.qty)}
                </span>
              ),
            },
            {
              key: "loss",
              header: "预计损耗率",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {pct(r.loss_rate)}
                </span>
              ),
            },
            {
              key: "effective",
              header: "实际含损耗用量",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-silver)]">
                  {fmt(r.qty * (1 + (r.loss_rate || 0)))}
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

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(2)}%`;
}
