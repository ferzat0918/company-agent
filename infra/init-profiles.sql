-- 用户 profiles 表 + admin_user_view 视图。
-- postgres 首次启动时由 docker-entrypoint-initdb.d/ 自动执行；也可以手动 `psql -f` 用作补迁移（语句全部幂等）。
-- 关联：前端 /admin 的"用户管理"标签页查 admin_user_view；个人主页 §01 ACCOUNT 查 profiles。

-- 1. profiles 主表（每个 auth.users 一行）
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dept       text DEFAULT '未分配',
  role       text DEFAULT '普通用户',
  region     text DEFAULT '未分配',
  created_at timestamptz DEFAULT now()
);

-- 2. 给已经存在的 auth.users 补出缺失的 profile（幂等：ON CONFLICT DO NOTHING）
INSERT INTO public.profiles (user_id, dept, role, region, created_at)
SELECT id, '未分配', '普通用户', '未分配', now()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 3. 注册触发器：以后任何新注册的用户都自动落一条 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, dept, role, region, created_at)
  VALUES (new.id, '未分配', '普通用户', '未分配', now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. admin_user_view —— 把 auth.users 和 profiles 拼成一张前端能直接消费的视图
CREATE OR REPLACE VIEW public.admin_user_view AS
SELECT
  u.id           AS user_id,
  u.email,
  u.created_at   AS registered_at,
  COALESCE(p.dept,   '未分配')   AS dept,
  COALESCE(p.role,   '普通用户') AS role,
  COALESCE(p.region, '未分配')   AS region
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id;

-- 5. 权限：PostgREST 用 postgres 角色暴露给前端，但 anon/authenticated 也得能读写
GRANT ALL    ON public.profiles        TO authenticated;
GRANT ALL    ON public.profiles        TO anon;
GRANT SELECT ON public.admin_user_view TO authenticated;
GRANT SELECT ON public.admin_user_view TO anon;
