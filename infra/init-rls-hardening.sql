-- RLS 加固：补上原生 init 脚本里没开的行级安全策略
--
-- 修复的核心威胁：
--   1. profiles 没开 RLS + GRANT ALL → 任何带 anon key 的人能 UPDATE 自己 role='系统管理员'
--      → 一旦升级，财务模块 / admin 后台 全部破防
--   2. LangGraph 内部表 (checkpoints/store/...) 被 anon/authenticated 全开 →
--      绕过 LangGraph API 直查 PostgREST 就能读所有人的聊天记录
--
-- 前置条件：
--   • 后端 (auth.py / profiles.py) 已改用 SUPABASE_SERVICE_KEY 读 profiles
--     （否则一开 RLS，所有登录用户的 dept/role 会变 unknown）
--
-- 全部幂等，可重复执行做补迁移。

-- ─────────────────────────────────────────────────────────────
-- 1. 守门函数：是否系统管理员
--    SECURITY DEFINER 避免在策略评估里递归触发 profiles 自己的 RLS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_system_admin()
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
      AND role = '系统管理员'
  );
$$;

REVOKE ALL ON FUNCTION public.is_system_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. profiles 表 RLS
--
-- 策略矩阵：
--   普通用户 → 可 SELECT 自己；不可 INSERT / UPDATE / DELETE（注册触发器走 SECURITY DEFINER 不受影响）
--   系统管理员 → SELECT / INSERT / UPDATE / DELETE 全表
--   后端 service_role → 自动绕过 RLS
--   anon → 完全无权
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self    ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin   ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_write    ON public.profiles;

CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

CREATE POLICY profiles_admin_write ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- 显式撤销 anon 对 profiles 的权限（之前 init-profiles.sql 给的 GRANT ALL）
REVOKE ALL ON public.profiles FROM anon;

-- authenticated 保留 GRANT（RLS 会管真正的访问），admin 写操作要 GRANT 才能跑
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. LangGraph 内部表：彻底撤销 anon / authenticated 权限
--    这些表只该被后端 (postgres 超级用户连接) 访问，不该走 PostgREST
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'checkpoints',
    'checkpoint_blobs',
    'checkpoint_writes',
    'checkpoint_migrations',
    'store',
    'store_migrations'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END$$;

-- ─────────────────────────────────────────────────────────────
-- 4. 让 PostgREST 立刻看到 schema 变化
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
