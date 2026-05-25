"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, X, Save, Search, RefreshCw } from "lucide-react";
import {
  DataTable,
  FieldLabel,
  FinanceInput,
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
  const [editing, setEditing] = useState<Partial<Material> | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toastNode } = useToast();

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
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.code} ${r.name} ${r.note ?? ""}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

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
        title="MATERIALS"
        subtitle="原料档案"
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
              {editing.id ? "EDIT / 编辑" : "NEW / 新建"} ·{" "}
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
              <FieldLabel required>原料编号 / CODE</FieldLabel>
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
              <FieldLabel required>原料名称 / NAME</FieldLabel>
              <FinanceInput
                value={editing.name ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="例：钢板 3mm"
              />
            </div>
            <div>
              <FieldLabel>单价 / UNIT PRICE</FieldLabel>
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
              <FieldLabel>最低库存预警 / MIN</FieldLabel>
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
              <FieldLabel>最高库存预警 / MAX</FieldLabel>
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
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
            <FinanceInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索编号 / 名称 / 备注"
              className="h-9 w-64 pl-7"
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
            {filtered.length} / {rows.length} 条
          </span>
        </div>

        <DataTable
          rows={filtered}
          empty={loading ? "LOADING..." : "尚无原料，点击右上角「新建原料」"}
          columns={[
            {
              key: "code",
              header: "CODE / 编号",
              width: "140px",
              render: (r) => (
                <span className="font-mono text-[12px]">{r.code}</span>
              ),
            },
            { key: "name", header: "NAME / 名称", render: (r) => r.name },
            {
              key: "price",
              header: "UNIT / 单价",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px]">{fmt(r.unit_price)}</span>
              ),
            },
            {
              key: "min",
              header: "MIN",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {fmt(r.min_stock)}
                </span>
              ),
            },
            {
              key: "max",
              header: "MAX",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {fmt(r.max_stock)}
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
