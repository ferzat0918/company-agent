# Finance 批量操作（第一期）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 finance 四个页面（materials / products / boms / moves）加多选 → 全选/反选、批量删除、导出选中。

**Architecture:** 共享 `DataTable` 增加可选 `selection` prop（不传时行为完全不变）；新增 `useRowSelection` hook 统一管理选中集合与失效修剪；新增 `BulkActionBar` 操作栏组件。四个页面各自接入，删除走 `supabase.delete().in('id', ids)`，导出选中直接用内存中已筛选的行生成 XLSX。

**Tech Stack:** Next.js (App Router, 静态导出) + React + TypeScript + Tailwind (UMX token) + supabase-js + xlsx。包管理 pnpm。

**对应 spec:** `docs/superpowers/specs/2026-06-10-finance-batch-operations-design.md`

**背景须知（执行者零上下文版）:**

- 前端目录：`frontend/agent-chat-ui`，构建命令 `pnpm build`（在该目录下执行），构建会跑 TS 类型检查，这是本项目唯一的自动验证手段（无前端测试框架）。`out/` 不在版本控制里，**不要**提交它。
- 四个页面结构高度一致：都有 `rows`（全量）、`filtered`（useMemo 筛选结果）、`fetchData`、`handleExport`、单条 `remove`、`useToast` 的 `show`。
- 行主键都是 `id: string`（uuid）。
- `DataTable` 还被 `finance/page.tsx`（库存总览）使用，那页**不接入**多选，必须保持不传 `selection` 时零变化。
- UI 风格：UMX 深色直角，acid 荧光绿 `var(--umx-acid)`，错误红 `#ff6b6b`，等宽小字 `font-mono text-[10px~12px] uppercase tracking`。复选框用原生 `<input type="checkbox">` + `accent-[var(--umx-acid)]`，不引第三方组件。

---

### Task 1: `DataTable` 增加可选 `selection` prop

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/_components.tsx`（`DataTable` 函数，约 41-119 行）

- [ ] **Step 1: 在 `Column<T>` 类型定义之后、`DataTable` 之前加入选择类型与表头复选框组件**

在 `_components.tsx` 中 `type Column<T> = {...};` 块之后插入：

```tsx
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
```

- [ ] **Step 2: 改写 `DataTable` 本体，支持 `selection`**

将现有 `DataTable` 整体替换为（与现状相比：新增 `selection` prop、表头/行首复选框列、选中行高亮、空行 colSpan +1；不传 `selection` 时渲染输出与原来逐字符一致）：

```tsx
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
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui` 目录）
Expected: 构建成功，无 TS 错误。库存总览等不传 `selection` 的调用方不需要任何改动。

- [ ] **Step 4: Commit**

```bash
git add frontend/agent-chat-ui/src/app/finance/_components.tsx
git commit -m "feat(finance): DataTable 支持可选多选列（selection prop）"
```

---

### Task 2: `useRowSelection` hook 与 `BulkActionBar` 组件

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/_components.tsx`

- [ ] **Step 1: 补充顶部导入**

`_components.tsx` 顶部现有：

```tsx
import React from "react";
import { cn } from "@/lib/utils";
```

改为：

```tsx
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Trash2, X } from "lucide-react";
```

注意：文件中段（`SearchableSelect` 之前）已有 `import { ChevronDown } from "lucide-react";` 与 `import { useState, useRef, useEffect } from "react";`，保留不动（import 会被提升，不冲突；`Download` 等新图标加在顶部这份 lucide import 里即可，两份 lucide import 命名不重复就合法。若 lint 抱怨重复 import 来源，把 `ChevronDown` 合并进顶部这一份并删掉中段那行）。

- [ ] **Step 2: 在 `DataTable` 之后加入 `useRowSelection`**

```tsx
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
```

- [ ] **Step 3: 在 `useRowSelection` 之后加入 `BulkActionBar`**

```tsx
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
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui`）
Expected: 构建成功。新组件暂无调用方，仅验证类型与导出无误。

- [ ] **Step 5: Commit**

```bash
git add frontend/agent-chat-ui/src/app/finance/_components.tsx
git commit -m "feat(finance): 新增 useRowSelection hook 与 BulkActionBar 批量操作栏"
```

---

### Task 3: materials 页接入

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/materials/page.tsx`

**本页常量：** 表 `fin_materials`、导出文件名 `materials_selected_<date>.xlsx`、sheet 名 `materials`、行类型 `Material`、确认文案对象「原料」。

- [ ] **Step 1: 更新 `../_components` 导入**

现有：

```tsx
import {
  DataTable,
  FieldLabel,
  FinanceInput,
  FinanceSelect,
  FinanceTextarea,
  SectionLabel,
  useToast,
} from "../_components";
```

改为：

```tsx
import {
  BulkActionBar,
  DataTable,
  FieldLabel,
  FinanceInput,
  FinanceSelect,
  FinanceTextarea,
  SectionLabel,
  useRowSelection,
  useToast,
} from "../_components";
```

- [ ] **Step 2: 接入选择状态与批量操作函数**

在 `const filtered = useMemo(...)` 块**之后**（hook 依赖 `filtered`，顺序不能颠倒）插入：

```tsx
  const {
    selectedIds,
    selection,
    clear: clearSelection,
  } = useRowSelection(filtered);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`确认删除选中的 ${ids.length} 条原料？不可恢复。`)) return;
    setBulkDeleting(true);
    const { error } = await supabase
      .from("fin_materials")
      .delete()
      .in("id", ids);
    setBulkDeleting(false);
    if (error) {
      show("err", `批量删除失败：${error.message}`);
      return;
    }
    show("ok", `已删除 ${ids.length} 条`);
    clearSelection();
    fetchData();
  };

  const exportSelected = () => {
    const data = filtered.filter((r) => selectedIds.has(r.id));
    if (data.length === 0) return;
    const fname = `materials_selected_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "materials");
    XLSX.writeFile(wb, fname);
    show("ok", `已导出选中的 ${data.length} 条记录`);
  };
```

- [ ] **Step 3: 渲染批量操作栏并把 selection 传给 DataTable**

在 JSX 里筛选条（`已筛选 N / M 条` 那个 div 块结束）与 `<DataTable` 之间插入：

```tsx
        <BulkActionBar
          count={selectedIds.size}
          deleting={bulkDeleting}
          onDelete={bulkDelete}
          onExport={exportSelected}
          onClear={clearSelection}
        />
```

并给 `<DataTable` 加一个 prop（紧跟 `rows={filtered}` 之后）：

```tsx
          selection={selection}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui`）
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add frontend/agent-chat-ui/src/app/finance/materials/page.tsx
git commit -m "feat(finance): materials 页支持多选、批量删除、导出选中"
```

---

### Task 4: products 页接入

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/products/page.tsx`

**本页常量：** 表 `fin_products`、导出文件名 `products_selected_<date>.xlsx`、sheet 名 `products`、行类型 `Product`、确认文案对象「成品」。

- [ ] **Step 1: 更新 `../_components` 导入**

在该页的 `../_components` import 列表中加入 `BulkActionBar,`（按字母序排第一）与 `useRowSelection,`（排在 `useToast` 之前），其余成员不动。

```tsx
import {
  BulkActionBar,
  DataTable,
  FieldLabel,
  FinanceInput,
  FinanceSelect,
  FinanceTextarea,
  SectionLabel,
  useRowSelection,
  useToast,
} from "../_components";
```

（若该页实际导入成员与上面略有出入，以保留原有成员、新增这两个为准。）

- [ ] **Step 2: 接入选择状态与批量操作函数**

在 `const filtered = useMemo(...)` 块之后插入：

```tsx
  const {
    selectedIds,
    selection,
    clear: clearSelection,
  } = useRowSelection(filtered);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`确认删除选中的 ${ids.length} 条成品？不可恢复。`)) return;
    setBulkDeleting(true);
    const { error } = await supabase
      .from("fin_products")
      .delete()
      .in("id", ids);
    setBulkDeleting(false);
    if (error) {
      show("err", `批量删除失败：${error.message}`);
      return;
    }
    show("ok", `已删除 ${ids.length} 条`);
    clearSelection();
    fetchData();
  };

  const exportSelected = () => {
    const data = filtered.filter((r) => selectedIds.has(r.id));
    if (data.length === 0) return;
    const fname = `products_selected_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "products");
    XLSX.writeFile(wb, fname);
    show("ok", `已导出选中的 ${data.length} 条记录`);
  };
```

- [ ] **Step 3: 渲染批量操作栏并把 selection 传给 DataTable**

筛选条与 `<DataTable`（约 466 行，`rows={filtered}`）之间插入：

```tsx
        <BulkActionBar
          count={selectedIds.size}
          deleting={bulkDeleting}
          onDelete={bulkDelete}
          onExport={exportSelected}
          onClear={clearSelection}
        />
```

并给 `<DataTable` 加 `selection={selection}`。

- [ ] **Step 4: 构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui`）
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add frontend/agent-chat-ui/src/app/finance/products/page.tsx
git commit -m "feat(finance): products 页支持多选、批量删除、导出选中"
```

---

### Task 5: boms 页接入

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/boms/page.tsx`

**本页常量：** 表 `fin_boms`、导出文件名 `boms_selected_<date>.xlsx`、sheet 名 `boms`、行类型 `Bom`、确认文案对象「BOM 配方」。

- [ ] **Step 1: 更新 `../_components` 导入**

在该页 `../_components` import 列表中新增两个成员：`BulkActionBar,`（按字母序排第一）与 `useRowSelection,`（排在 `useToast` 之前），原有成员（含 `SearchableSelect` 等）全部保留不动。

- [ ] **Step 2: 接入选择状态与批量操作函数**

在 `const filtered = useMemo(...)`（约 203 行）块之后插入：

```tsx
  const {
    selectedIds,
    selection,
    clear: clearSelection,
  } = useRowSelection(filtered);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`确认删除选中的 ${ids.length} 条 BOM 配方？不可恢复。`)) return;
    setBulkDeleting(true);
    const { error } = await supabase
      .from("fin_boms")
      .delete()
      .in("id", ids);
    setBulkDeleting(false);
    if (error) {
      show("err", `批量删除失败：${error.message}`);
      return;
    }
    show("ok", `已删除 ${ids.length} 条`);
    clearSelection();
    fetchAll();
  };

  const exportSelected = () => {
    const data = filtered.filter((r) => selectedIds.has(r.id));
    if (data.length === 0) return;
    const fname = `boms_selected_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "boms");
    XLSX.writeFile(wb, fname);
    show("ok", `已导出选中的 ${data.length} 条记录`);
  };
```

注意：boms 页的数据刷新函数叫 `fetchAll`（第 168 行附近，同时拉 boms/products/materials），上面代码里已经用的是 `fetchAll()`。

- [ ] **Step 3: 渲染批量操作栏并把 selection 传给 DataTable**

筛选条与 `<DataTable`（约 705 行，`rows={filtered}`）之间插入：

```tsx
        <BulkActionBar
          count={selectedIds.size}
          deleting={bulkDeleting}
          onDelete={bulkDelete}
          onExport={exportSelected}
          onClear={clearSelection}
        />
```

并给 `<DataTable` 加一个 prop（紧跟 `rows={filtered}` 之后）：

```tsx
          selection={selection}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui`）
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add frontend/agent-chat-ui/src/app/finance/boms/page.tsx
git commit -m "feat(finance): boms 页支持多选、批量删除、导出选中"
```

---

### Task 6: moves 页接入

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/moves/page.tsx`

**本页常量：** 表 `fin_stock_moves`、导出文件名 `stock_moves_selected_<date>.xlsx`、sheet 名 `moves`、行类型 `Move`、确认文案对象「流水」。

- [ ] **Step 1: 更新 `../_components` 导入**

在该页 `../_components` import 列表中新增两个成员：`BulkActionBar,`（按字母序排第一）与 `useRowSelection,`（排在 `useToast` 之前），原有成员全部保留不动。

- [ ] **Step 2: 接入选择状态与批量操作函数**

在 `const filtered = useMemo(...)`（约 263 行）块之后插入：

```tsx
  const {
    selectedIds,
    selection,
    clear: clearSelection,
  } = useRowSelection(filtered);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`确认删除选中的 ${ids.length} 条流水？删除会影响库存统计，不可恢复。`)) return;
    setBulkDeleting(true);
    const { error } = await supabase
      .from("fin_stock_moves")
      .delete()
      .in("id", ids);
    setBulkDeleting(false);
    if (error) {
      show("err", `批量删除失败：${error.message}`);
      return;
    }
    show("ok", `已删除 ${ids.length} 条`);
    clearSelection();
    fetchAll();
  };

  const exportSelected = () => {
    const data = filtered.filter((r) => selectedIds.has(r.id));
    if (data.length === 0) return;
    const fname = `stock_moves_selected_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "moves");
    XLSX.writeFile(wb, fname);
    show("ok", `已导出选中的 ${data.length} 条记录`);
  };
```

注意：moves 页切换 product/material tab（`kindTab`）会改变 `filtered`，`useRowSelection` 的修剪 effect 会自动清掉不属于当前 tab 的选中——这是预期行为，无需额外处理。moves 页的数据刷新函数叫 `fetchAll`（第 221 行附近），上面代码里已经用的是 `fetchAll()`。

- [ ] **Step 3: 渲染批量操作栏并把 selection 传给 DataTable**

筛选条与 `<DataTable`（约 836 行，`rows={filtered}`）之间插入：

```tsx
        <BulkActionBar
          count={selectedIds.size}
          deleting={bulkDeleting}
          onDelete={bulkDelete}
          onExport={exportSelected}
          onClear={clearSelection}
        />
```

并给 `<DataTable` 加一个 prop（紧跟 `rows={filtered}` 之后）：

```tsx
          selection={selection}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui`）
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add frontend/agent-chat-ui/src/app/finance/moves/page.tsx
git commit -m "feat(finance): moves 页支持多选、批量删除、导出选中"
```

---

### Task 7: 收尾 — 提交 spec/plan 文档 + 手动验证清单

**Files:**
- Add: `docs/superpowers/specs/2026-06-10-finance-batch-operations-design.md`（已存在，未跟踪）
- Add: `docs/superpowers/plans/2026-06-10-finance-batch-operations.md`

- [ ] **Step 1: 最终构建验证**

Run: `pnpm build`（在 `frontend/agent-chat-ui`）
Expected: 构建成功，无类型错误、无新增 lint 报错。

- [ ] **Step 2: 提交文档**

```bash
git add docs/superpowers/specs/2026-06-10-finance-batch-operations-design.md docs/superpowers/plans/2026-06-10-finance-batch-operations.md
git commit -m "docs: finance 批量操作第一期 spec 与实现计划"
```

- [ ] **Step 3: 手动验证（需要用户在浏览器里做，逐页 materials / products / boms / moves）**

1. 勾选若干行 → 操作栏出现「已选 N 项」；
2. 批量删除 → 确认弹窗 → 删除生效、toast 提示、列表刷新、选择清空；
3. 表头全选 → 全部勾选；再点一次 → 全部取消；部分勾选时表头呈半选（indeterminate）；
4. 全选 → 导出选中 → XLSX 文件含且仅含当前筛选出的行；
5. 勾选后修改筛选条件 → 不在新结果里的选中被自动剔除（操作栏计数变化）；
6. 库存总览页（finance 首页）表格渲染与改动前一致（无复选框列）；
7. boms/moves 若有外键约束导致删除被拒 → toast 显示错误信息且选择不丢失。
