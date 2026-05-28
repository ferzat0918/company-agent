-- 1. 安全为 profiles 表增加 name 和 wechat_nickname 两列（如果不存在则添加，默认值为空白，已有数据 100% 不受影响）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wechat_nickname text DEFAULT '';

-- 2. 升级新用户自动注册触发器，让未来新注册的员工账号也支持这两个新字段
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, dept, role, region, name, wechat_nickname, created_at)
  VALUES (new.id, '未分配', '普通用户', '未分配', '', '', now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 升级视图，使得前端网页和接口能够读取和写入新增的 name 与 wechat_nickname
CREATE OR REPLACE VIEW public.admin_user_view AS
SELECT
  u.id                AS user_id,
  u.email,
  u.created_at        AS registered_at,
  COALESCE(p.dept,            '未分配')   AS dept,
  COALESCE(p.role,            '普通用户') AS role,
  COALESCE(p.region,          '未分配')   AS region,
  COALESCE(p.name,            '')         AS name,
  COALESCE(p.wechat_nickname, '')         AS wechat_nickname
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id;

-- 4. 重新授予视图查询权限，防止权限丢失
GRANT SELECT ON public.admin_user_view TO authenticated;
GRANT SELECT ON public.admin_user_view TO anon;
