-- 财务模块（带 BOM 的进销存）数据库初始化
--
-- 5 张实体表 + 1 个库存视图 + 行级安全策略（仅财务部/系统管理员可访问）。
-- 全部幂等：可在生产环境重复执行做补迁移。
--
-- 关联：
--   • 前端 /finance/* 直接走 PostgREST 读写这些表（同 admin 页模式）
--   • RLS 通过 profiles.dept = '财务部' 或 role = '系统管理员' 放行

-- ─────────────────────────────────────────────────────────────
-- 1. 主数据：成品档案
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  price       NUMERIC(14,2) DEFAULT 0,
  min_stock   NUMERIC(14,2) DEFAULT 0,
  max_stock   NUMERIC(14,2) DEFAULT 0,
  note        TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. 主数据：原料档案
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  unit_price  NUMERIC(14,2) DEFAULT 0,
  min_stock   NUMERIC(14,2) DEFAULT 0,
  max_stock   NUMERIC(14,2) DEFAULT 0,
  note        TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. BOM 配方：一行 = 一个 (成品, 原料) 关系
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_boms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code   TEXT NOT NULL,
  material_code  TEXT NOT NULL,
  qty            NUMERIC(14,4) NOT NULL DEFAULT 0,
  loss_rate      NUMERIC(8,4)  NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_code, material_code)
);

CREATE INDEX IF NOT EXISTS fin_boms_product_idx  ON public.fin_boms (product_code);
CREATE INDEX IF NOT EXISTS fin_boms_material_idx ON public.fin_boms (material_code);

-- ─────────────────────────────────────────────────────────────
-- 4. 出入库流水（成品 + 原料合一张表，靠 kind 区分）
--
-- move_type 取值约定：
--   原料 (kind='material'):  采购入库 / 生产领料 / 退货出库 / 报损出库 / 领用出库
--   成品 (kind='product'):   生产入库 / 退货入库 / 销售出库 / 领用出库 / 报损出库
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_stock_moves (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT NOT NULL CHECK (kind IN ('product','material')),
  code              TEXT NOT NULL,
  move_type         TEXT NOT NULL,
  qty               NUMERIC(14,4) NOT NULL,
  unit_price        NUMERIC(14,2),
  platform          TEXT,
  customer          TEXT,
  ref_product_code  TEXT,
  is_repurchase     BOOLEAN DEFAULT FALSE,
  payment_date      DATE,
  note              TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fin_moves_lookup_idx ON public.fin_stock_moves (kind, code);
CREATE INDEX IF NOT EXISTS fin_moves_type_idx   ON public.fin_stock_moves (move_type);
CREATE INDEX IF NOT EXISTS fin_moves_time_idx   ON public.fin_stock_moves (occurred_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. 库存视图：复刻 Excel 的"SUMIFS 按类型分类汇总"
--    用 security_invoker=true，让查询时继承 fin_stock_moves 的 RLS
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.fin_inventory;
CREATE VIEW public.fin_inventory
WITH (security_invoker = true) AS
SELECT
  'product'::TEXT AS kind,
  p.code,
  p.name,
  p.min_stock,
  p.max_stock,
  COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type IN ('生产入库','退货入库')
  ), 0) AS in_qty,
  COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type IN ('销售出库','领用出库','报损出库')
  ), 0) AS out_qty,
  COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type IN ('生产入库','退货入库')
  ), 0)
  - COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type IN ('销售出库','领用出库','报损出库')
  ), 0) AS stock
FROM public.fin_products p
LEFT JOIN public.fin_stock_moves m
  ON m.kind = 'product' AND m.code = p.code
GROUP BY p.code, p.name, p.min_stock, p.max_stock

UNION ALL

SELECT
  'material'::TEXT AS kind,
  ma.code,
  ma.name,
  ma.min_stock,
  ma.max_stock,
  COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type = '采购入库'
  ), 0) AS in_qty,
  COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type IN ('生产领料','退货出库','报损出库','领用出库')
  ), 0) AS out_qty,
  COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type = '采购入库'
  ), 0)
  - COALESCE(SUM(m.qty) FILTER (
    WHERE m.move_type IN ('生产领料','退货出库','报损出库','领用出库')
  ), 0) AS stock
FROM public.fin_materials ma
LEFT JOIN public.fin_stock_moves m
  ON m.kind = 'material' AND m.code = ma.code
GROUP BY ma.code, ma.name, ma.min_stock, ma.max_stock;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS 守门函数
--    SECURITY DEFINER 让函数能跨过 profiles 自己的 RLS 去读，
--    避免在策略评估里递归触发权限检查。
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_is_finance_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND (dept = '财务部' OR role = '系统管理员')
  );
$$;

REVOKE ALL ON FUNCTION public.fin_is_finance_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fin_is_finance_user() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. 行级安全策略：只允许财务部 + 系统管理员 CRUD
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.fin_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_boms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_stock_moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_products_all    ON public.fin_products;
DROP POLICY IF EXISTS fin_materials_all   ON public.fin_materials;
DROP POLICY IF EXISTS fin_boms_all        ON public.fin_boms;
DROP POLICY IF EXISTS fin_stock_moves_all ON public.fin_stock_moves;

CREATE POLICY fin_products_all    ON public.fin_products    FOR ALL TO authenticated
  USING (public.fin_is_finance_user()) WITH CHECK (public.fin_is_finance_user());

CREATE POLICY fin_materials_all   ON public.fin_materials   FOR ALL TO authenticated
  USING (public.fin_is_finance_user()) WITH CHECK (public.fin_is_finance_user());

CREATE POLICY fin_boms_all        ON public.fin_boms        FOR ALL TO authenticated
  USING (public.fin_is_finance_user()) WITH CHECK (public.fin_is_finance_user());

CREATE POLICY fin_stock_moves_all ON public.fin_stock_moves FOR ALL TO authenticated
  USING (public.fin_is_finance_user()) WITH CHECK (public.fin_is_finance_user());

-- ─────────────────────────────────────────────────────────────
-- 8. 权限：PostgREST 暴露需要 GRANT；anon 不放行
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_products    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_materials   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_boms        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_stock_moves TO authenticated;
GRANT SELECT                         ON public.fin_inventory   TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. 让 PostgREST 立即看到新表
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
