-- 0004: admin 页用户管理 + 独立 finance 权限
--
-- 1) profiles.finance_access 独立开关(替代「dept=财务部」推导式 gate)
-- 2) fin_is_finance_user() 改为按 finance_access 放行(fin_* 表的 policy 引用此函数,无需改动)
-- 3) admin_user_view 暴露 finance_access
-- 4) 四个 SECURITY DEFINER RPC:建用户 / 改邮箱 / 重置密码 / 删用户
--    (生产前端是静态导出,浏览器 anon key 无权写 auth.users,只能走 RPC)
--
-- 已知坑:auth.users 的 token 类字段必须写 '' 而非 NULL,否则 GoTrue 扫描报错。
-- 全部幂等,可重复执行。
--
-- ⚠ 应用方式:必须以 supabase_admin(超级用户,5432 直连)执行,不能走 pg-meta /query。
--   pg-meta 以 postgres 角色执行:函数 owner 会落成 postgres,而 postgres 写不了
--   auth.users / auth.identities,RPC 运行时报 permission denied。下面的
--   ALTER FUNCTION ... OWNER TO supabase_admin 在走错路径时会直接报错,算是保险丝。
-- 前置依赖:public.is_system_admin()(infra/init-rls-hardening.sql,2026-06-12 已补到生产)。

-- ─────────────────────────────────────────────────────────────
-- 1. finance_access 列(回填只在列首次创建时执行一次,
--    重跑迁移不会把手动取消过的授权再加回来)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'finance_access'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN finance_access boolean NOT NULL DEFAULT false;
    UPDATE public.profiles SET finance_access = true WHERE dept = '财务部';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────
-- 2. finance gate 函数:finance_access 或 系统管理员
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_is_finance_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND (finance_access = true OR role = '系统管理员')
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. admin_user_view 加 finance_access 列
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_user_view AS
SELECT
  u.id                AS user_id,
  u.email,
  u.created_at        AS registered_at,
  COALESCE(p.dept,            '未分配')   AS dept,
  COALESCE(p.role,            '普通用户') AS role,
  COALESCE(p.region,          '未分配')   AS region,
  COALESCE(p.name,            '')         AS name,
  COALESCE(p.wechat_nickname, '')         AS wechat_nickname,
  COALESCE(p.finance_access,  false)      AS finance_access
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC:新建用户
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email           text,
  p_password        text,
  p_dept            text    DEFAULT '未分配',
  p_role            text    DEFAULT '普通用户',
  p_region          text    DEFAULT '未分配',
  p_name            text    DEFAULT '',
  p_wechat_nickname text    DEFAULT '',
  p_finance_access  boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION '仅系统管理员可操作';
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION '邮箱格式不正确';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION '邮箱已被注册';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION '密码至少 6 位';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id,
    'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(),
    '', '', '', '', '', '', '', '',
    false
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text,
                       'email', lower(p_email),
                       'email_verified', true),
    'email', now(), now(), now()
  );

  -- on_auth_user_created 触发器已建出默认 profile,这里补全字段
  UPDATE public.profiles SET
    dept            = COALESCE(p_dept, '未分配'),
    role            = COALESCE(p_role, '普通用户'),
    region          = COALESCE(p_region, '未分配'),
    name            = COALESCE(p_name, ''),
    wechat_nickname = COALESCE(p_wechat_nickname, ''),
    finance_access  = COALESCE(p_finance_access, false)
  WHERE user_id = v_user_id;

  RETURN v_user_id;
END;
$$;

ALTER FUNCTION public.admin_create_user(text,text,text,text,text,text,text,boolean) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.admin_create_user(text,text,text,text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text,text,text,text,text,text,text,boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC:改邮箱
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_user_email(
  p_user_id   uuid,
  p_new_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION '仅系统管理员可操作';
  END IF;
  IF p_new_email IS NULL OR p_new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION '邮箱格式不正确';
  END IF;
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(p_new_email) AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION '邮箱已被注册';
  END IF;

  UPDATE auth.users
  SET email = lower(p_new_email), updated_at = now()
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  UPDATE auth.identities
  SET identity_data = identity_data || jsonb_build_object('email', lower(p_new_email)),
      updated_at = now()
  WHERE user_id = p_user_id AND provider = 'email';
END;
$$;

ALTER FUNCTION public.admin_update_user_email(uuid,text) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.admin_update_user_email(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(uuid,text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC:重置密码
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_user_id      uuid,
  p_new_password text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION '仅系统管理员可操作';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION '密码至少 6 位';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_reset_password(uuid,text) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.admin_reset_password(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(uuid,text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC:删除用户(profiles 经 FK CASCADE、identities 经 GoTrue 外键级联删除)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION '仅系统管理员可操作';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION '不能删除自己';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_delete_user(uuid) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. 让 PostgREST 立刻看到 schema 变化
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
