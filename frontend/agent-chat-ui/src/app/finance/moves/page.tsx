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
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
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
  const [editing, setEditing] = useState<Partial<Move> | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toastNode } = useToast();

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.kind !== kindTab) return false;
      if (typeFilter !== "all" && r.move_type !== typeFilter) return false;
      if (q) {
        const hay = `${r.code} ${productMap[r.code] ?? ""} ${materialMap[r.code] ?? ""} ${r.customer ?? ""} ${r.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, kindTab, typeFilter, query, productMap, materialMap]);

  const codeList = editing?.kind === "material" ? materials : products;

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
        title="STOCK MOVES"
        subtitle="出入库流水"
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
            {k === "product" ? "成品流水 / PRODUCT" : "原料流水 / MATERIAL"}
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
              {editing.id ? "EDIT / 编辑流水" : "NEW / 新增流水"}
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
              <FieldLabel required>类型 / KIND</FieldLabel>
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
              <FieldLabel required>动作 / MOVE TYPE</FieldLabel>
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
                {editing.kind === "material" ? "原料 / MATERIAL" : "成品 / PRODUCT"}
              </FieldLabel>
              <FinanceSelect
                value={editing.code ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, code: e.target.value })
                }
              >
                <option value="">— 选编号 —</option>
                {codeList.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.code} · {x.name}
                  </option>
                ))}
              </FinanceSelect>
            </div>
            <div>
              <FieldLabel required>数量 / QTY</FieldLabel>
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
            <div className="md:col-span-2">
              <FieldLabel>发生时间 / OCCURRED AT</FieldLabel>
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
                    <FieldLabel>销售平台 / PLATFORM</FieldLabel>
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
                    <FieldLabel>客户 / CUSTOMER</FieldLabel>
                    <FinanceInput
                      value={editing.customer ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, customer: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>回款日期 / PAYMENT</FieldLabel>
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
                      回购客户 / REPURCHASE
                    </label>
                  </div>
                </>
              )}

            {/* 原料生产领料：关联成品 */}
            {editing.kind === "material" &&
              editing.move_type === "生产领料" && (
                <div className="md:col-span-2">
                  <FieldLabel>对应成品 / FOR PRODUCT</FieldLabel>
                  <FinanceSelect
                    value={editing.ref_product_code ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        ref_product_code: e.target.value || null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {products.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} · {p.name}
                      </option>
                    ))}
                  </FinanceSelect>
                </div>
              )}

            <div className="md:col-span-4">
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

      {/* 筛选 + 表 */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)]" />
            <FinanceInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 编号 / 名称 / 客户 / 备注"
              className="h-9 w-72 pl-7"
            />
          </div>
          <FinanceSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-40"
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
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--umx-text-dim)]">
            {filtered.length} / {rows.filter((r) => r.kind === kindTab).length} 条
          </span>
        </div>

        <DataTable
          rows={filtered}
          empty={loading ? "LOADING..." : "尚无流水"}
          columns={[
            {
              key: "time",
              header: "TIME / 时间",
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
              header: "TYPE / 动作",
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
              header: "CODE / 编号",
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
              header: "QTY / 数量",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[13px] font-bold">
                  {fmt(r.qty)}
                </span>
              ),
            },
            {
              key: "price",
              header: "PRICE",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-text-dim)]">
                  {r.unit_price ? fmt(r.unit_price) : "—"}
                </span>
              ),
            },
            {
              key: "amount",
              header: "AMOUNT",
              className: "text-right",
              render: (r) => (
                <span className="font-mono text-[12px] text-[var(--umx-silver)]">
                  {r.unit_price ? fmt(Number(r.qty) * Number(r.unit_price)) : "—"}
                </span>
              ),
            },
            {
              key: "ctx",
              header: "PLATFORM / CUSTOMER",
              render: (r) => (
                <span className="text-[12px] text-[var(--umx-silver)]">
                  {[r.platform, r.customer, r.ref_product_code]
                    .filter(Boolean)
                    .join(" · ") || "—"}
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
              header: "NOTE",
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
