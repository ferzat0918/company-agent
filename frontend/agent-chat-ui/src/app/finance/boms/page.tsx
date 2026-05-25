"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  DataTable,
  FieldLabel,
  FinanceInput,
  FinanceSelect,
  FinanceTextarea,
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

const EMPTY: Partial<Bom> = {
  product_code: "",
  material_code: "",
  qty: 1,
  loss_rate: 0,
  note: "",
};

export default function FinanceBomsPage() {
  const [rows, setRows] = useState<Bom[]>([]);
  const [products, setProducts] = useState<Picker[]>([]);
  const [materials, setMaterials] = useState<Picker[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<Bom> | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toastNode } = useToast();

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (productFilter !== "all" && r.product_code !== productFilter) return false;
      if (q) {
        const hay = `${r.product_code} ${r.material_code} ${productMap[r.product_code] ?? ""} ${materialMap[r.material_code] ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, productFilter, query, productMap, materialMap]);

  const startNew = () => setEditing({ ...EMPTY });
  const startEdit = (r: Bom) => setEditing({ ...r });
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    if (!editing.product_code || !editing.material_code) {
      show("err", "成品和原料都要选");
      return;
    }
    setSaving(true);
    const payload = {
      product_code: editing.product_code,
      material_code: editing.material_code,
      qty: Number(editing.qty) || 0,
      loss_rate: Number(editing.loss_rate) || 0,
      note: editing.note?.trim() || null,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("fin_boms")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("fin_boms").insert(payload));
    }
    setSaving(false);
    if (error) {
      show(
        "err",
        error.code === "23505"
          ? "该 成品+原料 组合已存在，请改用编辑"
          : `保存失败：${error.message}`,
      );
      return;
    }
    show("ok", editing.id ? "已更新" : "已新建");
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
        title="BOM"
        subtitle="配方表 / Bill of Materials"
        right={
          <>
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
              {editing.id ? "EDIT / 编辑配方" : "NEW / 新增配方"}
            </h3>
            <button
              onClick={cancel}
              className="text-[var(--umx-text-dim)] hover:text-[var(--umx-white)]"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <FieldLabel required>成品 / PRODUCT</FieldLabel>
              <FinanceSelect
                value={editing.product_code ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, product_code: e.target.value })
                }
                disabled={!!editing.id}
              >
                <option value="">— 选成品 —</option>
                {products.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </FinanceSelect>
            </div>
            <div className="md:col-span-2">
              <FieldLabel required>原料 / MATERIAL</FieldLabel>
              <FinanceSelect
                value={editing.material_code ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, material_code: e.target.value })
                }
                disabled={!!editing.id}
              >
                <option value="">— 选原料 —</option>
                {materials.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} · {m.name}
                  </option>
                ))}
              </FinanceSelect>
            </div>
            <div>
              <FieldLabel required>用量 / QTY (per 1 unit)</FieldLabel>
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
              <FieldLabel>损耗率 / LOSS (0.05 = 5%)</FieldLabel>
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
              <FieldLabel>备注 / NOTE</FieldLabel>
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
              {saving ? "SAVING..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
            <FinanceInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 成品 / 原料 / 编号"
              className="h-9 w-64 pl-7"
            />
          </div>
          <FinanceSelect
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-56"
          >
            <option value="all">全部成品</option>
            {products.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} · {p.name}
              </option>
            ))}
          </FinanceSelect>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
            {filtered.length} / {rows.length} 条
          </span>
        </div>

        <DataTable
          rows={filtered}
          empty={
            loading ? "LOADING..." : "尚无配方，点击右上角「新建配方」"
          }
          columns={[
            {
              key: "p_code",
              header: "PRODUCT / 成品",
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
              header: "MATERIAL / 原料",
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
              header: "QTY / 用量",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[13px] font-bold">
                  {fmt(r.qty)}
                </span>
              ),
            },
            {
              key: "loss",
              header: "LOSS / 损耗",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {pct(r.loss_rate)}
                </span>
              ),
            },
            {
              key: "effective",
              header: "EFFECTIVE / 含损耗",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-silver)]">
                  {fmt(r.qty * (1 + (r.loss_rate || 0)))}
                </span>
              ),
            },
            {
              key: "note",
              header: "NOTE / 备注",
              render: (r) => (
                <span className="text-[12px] text-[var(--umx-silver)]">
                  {r.note || "—"}
                </span>
              ),
            },
            {
              key: "ops",
              header: "OPS",
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
