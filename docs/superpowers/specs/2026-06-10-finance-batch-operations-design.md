# Finance 批量操作设计（第一期）

日期：2026-06-10
范围：`frontend/agent-chat-ui` 的四个 finance 页面（原料 materials / 产品 products / BOM boms / 出入库 moves）

## 背景与目标

四个 finance 页面目前每行只有单条「编辑 / 删除」按钮，没有多选机制。用户希望支持多选后批量操作。

经讨论确定**分两期**：

- **第一期（本 spec）**：全选/反选、批量删除、批量导出选中。三者共用一套选择机制、全是低风险操作。
- **第二期（后续单独设计）**：批量改字段（批量写库、每表字段不同、需校验，单独设计与测试）。

## 关键现状

- 四个页面共用 `src/app/finance/_components.tsx` 里的 `DataTable<T>` 组件。
- `DataTable` 当前一次性 `rows.map` 渲染**全部筛选结果，没有分页**。因此「跨页选择」不存在——**全选 = 选中当前筛选出来的所有行**。
- 每个页面已有：筛选后的行数组（如 materials 的 `filtered`/`rows`）、`handleExport`（XLSX 全表导出）、单条删除、`useToast` 反馈、`supabase` 客户端。
- 每行有稳定主键 `id`（uuid）。
- `DataTable` 也被 admin 等其它页面使用，改动必须向后兼容。

## 架构

核心：**把多选能力作为可选 prop 加进共享 `DataTable`**，四个页面统一获得复选框，避免每页各写一套。

### 1. `DataTable` 扩展（`_components.tsx`）

新增可选 prop：

```ts
selection?: {
  selectedIds: Set<string>;
  getId: (row: T) => string;       // 通常 row => row.id
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;          // 全选/全不选当前 rows
  allChecked: boolean;              // 当前 rows 是否全部选中
  someChecked: boolean;             // 部分选中（用于 indeterminate 视觉）
};
```

行为：

- **不传 `selection` 时，渲染与现在完全一致**（admin 等调用方零影响）。
- 传入时：
  - 表头最左加一列，含全选复选框（`allChecked` 勾选；`someChecked && !allChecked` 时显示 indeterminate 半选样式）。
  - 每行最左加复选框，勾选状态来自 `selectedIds.has(getId(row))`。
  - 选中行加高亮（acid 色描边/底色，沿用现有 UMX token）。
  - 复选框列宽固定、点击复选框 `stopPropagation`，不触发行内其它交互。
  - 空状态行的 `colSpan` 自动 +1。

复选框使用原生 `<input type="checkbox">` + UMX 风格类，不引第三方组件。indeterminate 通过 ref 设置 `el.indeterminate`。

### 2. 每个页面接入（materials / products / boms / moves 各一份，结构相同）

每页新增：

- `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`。
- 选择操作的 helper：`toggleRow(id)`、`toggleAll()`（基于当前筛选结果集合）、`clearSelection()`。
- **数据变化时清理失效选中**：`fetchData` 刷新、筛选条件变化后，从 `selectedIds` 中剔除已不在当前结果里的 id（避免「幽灵选中」）。
- 把 `selection` 对象传给 `DataTable`。
- **批量操作栏**：`selectedIds.size > 0` 时在表格上方浮现一条 bar，显示「已选 N 项」+ 三个按钮：
  - **批量删除**：弹确认（「确认删除选中的 N 项？不可恢复」）→ `supabase.from(table).delete().in('id', [...selectedIds])` → toast 成功/失败 → `clearSelection()` + `fetchData()`。
  - **导出选中**：复用本页导出逻辑，数据源换成「当前结果里 id ∈ selectedIds 的行」，直接用内存中已有的行数据生成 XLSX（无需再查库），文件名沿用 `<table>_selected_<date>.xlsx`。
  - **取消选择**：`clearSelection()`。

各页 `table` 名与导出 sheet 名沿用现有常量（`fin_materials` 等）。

## 数据流

```
用户勾选行 → toggleRow 更新 selectedIds(Set)
           → DataTable 依据 selectedIds 重渲染勾选态 + 高亮
表头全选 → toggleAll：若当前结果全已选则清空，否则并入全部当前结果 id
批量删除 → 确认 → supabase delete .in('id', ids) → 清选择 + 重新拉取
导出选中 → 过滤内存行(id∈ids) → XLSX.writeFile
筛选/刷新 → 用新结果集合修剪 selectedIds
```

## 错误处理

- 删除失败：toast 显示 `error.message`，不清空选择（便于重试）。
- 删除部分受 RLS/外键约束失败：supabase 返回 error，整体提示失败；第一期不做逐行结果拆分。
- 导出时选中为空：按钮在 `size===0` 时整条 bar 不显示，无此路径。
- BOM/出入库存在外键引用时删除可能被数据库拒绝 → 走 toast 失败提示，符合现有单条删除的既有行为。

## 测试

无既有前端测试框架，采用构建校验 + 手动验证：

1. `pnpm build` 通过（TS 类型 + 静态导出），提交更新后的 `out/`。
2. 手动逐页验证：勾选若干行→批量删除（确认弹窗、删除生效、列表刷新）；全选→导出选中（文件含且仅含选中行）；改筛选条件后选中态被正确修剪；不传 selection 的 admin 表格渲染无变化。

## 不做（YAGNI / 留待第二期）

- 批量改字段。
- 跨页选择 / 分页（当前无分页）。
- 逐行删除结果报告、撤销删除。
- 选中状态持久化（刷新页面后保留）。
```
