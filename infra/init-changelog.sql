-- 动态更新日志数据表初始化脚本
-- 幂等设计：多次运行不会破坏已有数据或导致冲突。

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version       TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  release_date  DATE NOT NULL DEFAULT current_date,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 为排序查询构建高性能索引
CREATE INDEX IF NOT EXISTS idx_changelog_date ON public.changelog_entries (release_date DESC, version DESC);

-- 启用行级安全（RLS）以防范非授权写入
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

-- 策略 1：所有用户（包括匿名访客与已登录用户）均可自由读取日志列表（SELECT）
DROP POLICY IF EXISTS changelog_select_all ON public.changelog_entries;
CREATE POLICY changelog_select_all ON public.changelog_entries
  FOR SELECT TO anon, authenticated
  USING (true);

-- 策略 2：仅允许已通过身份认证且具有系统管理员角色的用户进行数据修改操作（ALL：INSERT, UPDATE, DELETE）
DROP POLICY IF EXISTS changelog_admin_all ON public.changelog_entries;
CREATE POLICY changelog_admin_all ON public.changelog_entries
  FOR ALL TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- 显式对表授权，使得 PostgREST（Supabase REST API）能够处理该表的请求
GRANT SELECT ON public.changelog_entries TO anon, authenticated;
GRANT ALL ON public.changelog_entries TO authenticated;

-- 通知 PostgREST 重新加载 Schema 缓存以使更改立刻在前台生效
NOTIFY pgrst, 'reload schema';
