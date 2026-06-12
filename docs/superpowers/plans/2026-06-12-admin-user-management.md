# Admin 用户管理 + 独立 finance 权限 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin 页可以直接新建用户、编辑用户全部信息(邮箱/密码/姓名/微信昵称/部门/角色/区域)、删除用户,并把 finance 访问权改为独立的 `profiles.finance_access` 开关。

**Architecture:** 生产前端是 Next.js 静态导出 + nginx,没有 Node 服务端,所以所有动 `auth.users` 的操作走 Postgres SECURITY DEFINER RPC(经 PostgREST `supabase.rpc()` 调用),函数内部用现有 `is_system_admin()` 守门。finance gate 集中在 `fin_is_finance_user()` 一个函数里,改函数体即完成 RLS 切换。

**Tech Stack:** PostgreSQL (pgcrypto bcrypt) / PostgREST RPC / Next.js 静态导出 / supabase-js / framer-motion + UMX 视觉风格。

**Spec:** `docs/superpowers/specs/2026-06-12-admin-user-management-design.md`

**注意:** 本项目无前端测试基建,SQL 部分用 pg-meta 烟雾测试验证,前端用 `npm run build`(TS 编译即门禁)+ 手工验证清单。

---

### Task 1: 数据库迁移文件

**Files:**
- Create: `infra/migrations/0004_admin_user_management.sql`

- [ ] **Step 1: 写迁移文件**(完整内容如下,全部幂等):

```sql
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

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. 让 PostgREST 立刻看到 schema 变化
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Commit**

```powershell
git add infra/migrations/0004_admin_user_management.sql
git commit -m "feat(db): admin 用户管理 RPC + profiles.finance_access 独立开关"
```

---

### Task 2: 应用迁移到生产库并烟雾测试

生产库管理端点:`POST http://192.168.1.100:8085/query`(pg-meta,body `{"query":"<SQL>"}`,以 `postgres` 角色执行)。

**PowerShell 调用坑:** JSON 别直接 `-d` 传,会被 shell 解析坏。先用 `[System.IO.File]::WriteAllText()` 写临时文件(UTF-8 无 BOM),再 `curl.exe --data-binary "@file"`。

- [ ] **Step 1: 把迁移 SQL 打到生产库**

```powershell
$sql = Get-Content -Raw infra/migrations/0004_admin_user_management.sql
$body = @{ query = $sql } | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText("$env:TEMP\mig0004.json", $body, (New-Object System.Text.UTF8Encoding $false))
curl.exe -s -X POST http://192.168.1.100:8085/query -H "Content-Type: application/json" --data-binary "@$env:TEMP\mig0004.json"
```

Expected: 返回 `[]` 或结果数组,**没有** `"error"` 字段。

- [ ] **Step 2: 结构验证**(同样方式 POST 下面的 SQL):

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name='profiles' AND column_name='finance_access') AS col_ok,
  (SELECT count(*) FROM pg_proc WHERE proname IN
   ('admin_create_user','admin_update_user_email','admin_reset_password','admin_delete_user')) AS rpc_ok,
  (SELECT count(*) FROM public.profiles WHERE dept='财务部' AND finance_access=false) AS missed_backfill;
```

Expected: `col_ok=1`,`rpc_ok=4`,`missed_backfill=0`。

- [ ] **Step 3: RPC 烟雾测试**(模拟管理员 JWT 走完整生命周期,自清理):

```sql
DO $$
DECLARE
  v_admin uuid;
  v_new   uuid;
BEGIN
  SELECT user_id INTO v_admin FROM public.profiles WHERE role = '系统管理员' LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION '库里没有系统管理员,先去 profiles 设置一个'; END IF;
  -- auth.uid() 读 request.jwt.claims,事务内伪造成管理员
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_new := public.admin_create_user('smoke-test@umx.local', 'test123456',
            '研发部', '普通用户', '国内市场', '烟雾测试', '', false);
  RAISE NOTICE 'created user %', v_new;

  PERFORM public.admin_reset_password(v_new, 'newpass123');
  PERFORM public.admin_update_user_email(v_new, 'smoke-test-2@umx.local');
  PERFORM public.admin_delete_user(v_new);

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_new) THEN
    RAISE EXCEPTION '删除失败,用户还在';
  END IF;
  RAISE NOTICE 'smoke test OK';
END$$;
```

Expected: 无 error。

**如果报 `permission denied for table users`:** pg-meta 的 `postgres` 角色写不了 auth schema。兜底:用 5432 直连 `supabase_admin`(超级用户,密码=POSTGRES_PASSWORD,见 `.env`)重放整个迁移文件——这样函数 owner 变成超级用户,SECURITY DEFINER 运行时即有权限:

```powershell
python -c "import psycopg, pathlib; sql = pathlib.Path('infra/migrations/0004_admin_user_management.sql').read_text(encoding='utf-8'); conn = psycopg.connect('host=192.168.1.100 port=5432 dbname=postgres user=supabase_admin password=<POSTGRES_PASSWORD>'); conn.execute(sql); conn.commit(); print('ok')"
```

(本机 psycopg 之前装过 `psycopg-binary`;`<POSTGRES_PASSWORD>` 从仓库根 `.env` 里取。)重放后重跑 Step 2、3。

- [ ] **Step 4: 用真实 anon JWT 验证守门**(可选但推荐):用一个**普通用户**的 access_token 调 PostgREST RPC,应被拒:

```powershell
curl.exe -s -X POST http://192.168.1.100/rest/v1/rpc/admin_delete_user -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <普通用户access_token>" -H "Content-Type: application/json" -d "{\"p_user_id\":\"00000000-0000-0000-0000-000000000001\"}"
```

Expected: 返回 `仅系统管理员可操作` 错误。(token 可从浏览器 localStorage 的 supabase session 里拿;如嫌麻烦可跳过,Task 6 手工验证也覆盖。)

---

### Task 3: admin 页 — 类型扩展 + FINANCE 列 + 新建用户抽屉

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/admin/page.tsx`

- [ ] **Step 1: 扩展 `UserViewRow` 类型**(约 line 52):

```tsx
type UserViewRow = {
  user_id: string;
  email: string | null;
  registered_at: string;
  dept: string;
  role: string;
  region: string;
  name: string;
  wechat_nickname: string;
  finance_access: boolean;
};
```

- [ ] **Step 2: 补图标导入**:找到文件顶部 `from "lucide-react"` 的 import,在花括号里加 `UserPlus, KeyRound, Trash2, Wallet`(已有的不要重复)。

- [ ] **Step 3: 新增 `UserCreateDrawer` 组件**:加在 `UserEditDrawer` 组件(约 line 731)之前,完整代码:

```tsx
/* ── User Create Drawer ──────────────────────────────────────── */

function UserCreateDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [wechat, setWechat] = useState("");
  const [dept, setDept] = useState("未分配");
  const [role, setRole] = useState("普通用户");
  const [region, setRegion] = useState("未分配");
  const [financeAccess, setFinanceAccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!email.trim()) { alert("请填写邮箱"); return; }
    if (password.length < 6) { alert("密码至少 6 位"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_create_user", {
      p_email: email.trim(),
      p_password: password,
      p_dept: dept,
      p_role: role,
      p_region: region,
      p_name: name.trim(),
      p_wechat_nickname: wechat.trim(),
      p_finance_access: financeAccess,
    });
    setSaving(false);
    if (error) {
      alert("创建失败:" + error.message);
    } else {
      onCreated();
      onClose();
    }
  };

  const inputCls =
    "w-full border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] transition-colors placeholder:text-[var(--umx-text-dim)]";
  const labelCls =
    "font-display text-[11px] font-bold text-white uppercase tracking-wider block";
  const selectCls =
    "w-full appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex h-full w-[450px] max-w-full flex-col border-l border-[var(--umx-line)] bg-[var(--umx-bg-1)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--umx-line)] px-6 py-5 bg-[var(--umx-bg-0)]">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-[var(--umx-acid)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--umx-white)] uppercase">CREATE NEW USER</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center border border-[var(--umx-line)] text-[var(--umx-text-dim)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)] transition-colors"
            style={{ borderRadius: "2px" }}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 umx-scrollbar">
          <div className="space-y-2">
            <label className={labelCls}>登录邮箱 (EMAIL) *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className={inputCls} style={{ borderRadius: "2px" }} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>初始密码 (PASSWORD, ≥6 位) *</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" className={inputCls} style={{ borderRadius: "2px" }} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>姓名 (NAME)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="选填" className={inputCls} style={{ borderRadius: "2px" }} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>微信昵称 (WECHAT)</label>
            <input value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="选填" className={inputCls} style={{ borderRadius: "2px" }} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>分配部门 (DEPARTMENT)</label>
            <div className="relative">
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={selectCls} style={{ borderRadius: "2px" }}>
                {DEPTS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>分配角色 (ROLE)</label>
            <div className="relative">
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls} style={{ borderRadius: "2px" }}>
                {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>所属地区 (REGION)</label>
            <div className="relative">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls} style={{ borderRadius: "2px" }}>
                {REGIONS.map((reg) => (<option key={reg} value={reg}>{reg}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Finance access toggle */}
          <button
            onClick={() => setFinanceAccess((v) => !v)}
            className="flex w-full items-center justify-between border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-4 py-3 transition-colors hover:border-[var(--umx-acid)]"
            style={{ borderRadius: "2px" }}
          >
            <span className="flex items-center gap-2 font-display text-[11px] font-bold text-white uppercase tracking-wider">
              <Wallet className="size-3.5 text-[var(--umx-acid)]" />
              财务工作台访问权 (FINANCE)
            </span>
            <span
              className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider border"
              style={financeAccess
                ? { color: "var(--umx-acid)", borderColor: "rgba(218,252,8,0.4)", background: "rgba(218,252,8,0.06)", borderRadius: "2px" }
                : { color: "var(--umx-text-dim)", borderColor: "var(--umx-line)", borderRadius: "2px" }}
            >
              {financeAccess ? "GRANTED" : "DENIED"}
            </span>
          </button>

          <div className="pt-4 border-t border-[var(--umx-line)] flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-[var(--umx-line)] hover:border-white font-mono text-[10px] uppercase tracking-widest text-[var(--umx-silver)] transition-all font-bold"
              style={{ borderRadius: "2px" }}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 py-2.5 font-mono text-[10px] uppercase tracking-widest text-black bg-[var(--umx-acid)] hover:bg-white disabled:bg-[var(--umx-line)] disabled:text-[var(--umx-text-dim)] transition-all font-bold"
              style={{ borderRadius: "2px", cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "CREATING..." : "创建用户"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
```

- [ ] **Step 4: 接线**。在 admin 主组件里(`selectedUser` state 旁,约 line 1184)加状态:

```tsx
const [createUserOpen, setCreateUserOpen] = useState(false);
```

用户筛选栏的导出按钮组(`{/* Exporter Buttons */}`,约 line 1914 的 `<div className="ml-auto flex items-center gap-2">`)里,在 CSV 按钮**前**加:

```tsx
<button
  onClick={() => setCreateUserOpen(true)}
  className="flex items-center gap-1.5 border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-2.5 py-2 font-mono text-[9px] uppercase tracking-wider font-bold transition-all"
  style={{ borderRadius: "2px" }}
>
  <UserPlus className="size-3" />
  新建用户
</button>
```

文件尾部 `UserEditDrawer` 的 `<AnimatePresence>` 块(约 line 2251)后面,加渲染:

```tsx
{/* Slide-over User Create Drawer Panel */}
<AnimatePresence>
  {createUserOpen && (
    <UserCreateDrawer
      onClose={() => setCreateUserOpen(false)}
      onCreated={fetchUsers}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 5: 用户表加 FINANCE 列**。表头(约 line 1958 REGION 那个 `<th>` 之后)加:

```tsx
<th className="px-6 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">FINANCE</th>
```

行内(REGION 的 `<td>` 之后、REGISTERED DATE 的 `<td>` 之前)加:

```tsx
<td className="px-6 py-4">
  {userRow.finance_access ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider border text-[var(--umx-acid)]" style={{ background: "rgba(218,252,8,0.03)", borderColor: "rgba(218,252,8,0.2)", borderRadius: "2px" }}>
      <Wallet className="size-2.5" />
      GRANTED
    </span>
  ) : (
    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">—</span>
  )}
</td>
```

- [ ] **Step 6: 编译验证**

```powershell
cd frontend/agent-chat-ui; npm run build
```

Expected: 编译通过,无 TS 错误。

- [ ] **Step 7: Commit**

```powershell
git add frontend/agent-chat-ui/src/app/admin/page.tsx
git commit -m "feat(admin): 新建用户抽屉 + 用户列表 finance 权限列"
```

---

### Task 4: admin 页 — UserEditDrawer 全面扩展

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/admin/page.tsx`(`UserEditDrawer` 组件,约 line 731-903;以及主组件接线处)

- [ ] **Step 1: 整体替换 `UserEditDrawer` 组件** 为以下完整实现(新增:邮箱编辑、姓名/微信、finance 开关、重置密码、删除用户;`onDelete` 是新 prop):

```tsx
function UserEditDrawer({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: UserViewRow;
  onClose: () => void;
  onSave: (updated: UserViewRow) => void;
  onDelete: (userId: string) => void;
}) {
  const [email, setEmail] = useState(item.email || "");
  const [name, setName] = useState(item.name || "");
  const [wechat, setWechat] = useState(item.wechat_nickname || "");
  const [dept, setDept] = useState(item.dept || "未分配");
  const [role, setRole] = useState(item.role || "普通用户");
  const [region, setRegion] = useState(item.region || "未分配");
  const [financeAccess, setFinanceAccess] = useState(item.finance_access ?? false);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setEmail(item.email || "");
    setName(item.name || "");
    setWechat(item.wechat_nickname || "");
    setDept(item.dept || "未分配");
    setRole(item.role || "普通用户");
    setRegion(item.region || "未分配");
    setFinanceAccess(item.finance_access ?? false);
    setNewPassword("");
  }, [item]);

  const handleSave = async () => {
    setSaving(true);
    // 邮箱变了走 RPC(动 auth.users),其余字段走 profiles
    if (email.trim() && email.trim() !== (item.email || "")) {
      const { error } = await supabase.rpc("admin_update_user_email", {
        p_user_id: item.user_id,
        p_new_email: email.trim(),
      });
      if (error) {
        setSaving(false);
        alert("邮箱更新失败:" + error.message);
        return;
      }
    }
    const { error } = await supabase.from("profiles").upsert({
      user_id: item.user_id,
      dept,
      role,
      region,
      name: name.trim(),
      wechat_nickname: wechat.trim(),
      finance_access: financeAccess,
    });
    setSaving(false);
    if (!error) {
      onSave({
        ...item,
        email: email.trim() || item.email,
        dept,
        role,
        region,
        name: name.trim(),
        wechat_nickname: wechat.trim(),
        finance_access: financeAccess,
      });
      onClose();
    } else {
      alert("更新失败:" + error.message);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { alert("密码至少 6 位"); return; }
    setResetting(true);
    const { error } = await supabase.rpc("admin_reset_password", {
      p_user_id: item.user_id,
      p_new_password: newPassword,
    });
    setResetting(false);
    if (error) {
      alert("重置失败:" + error.message);
    } else {
      alert("密码已重置");
      setNewPassword("");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要永久删除用户 ${item.email || item.user_id} 吗?此操作不可恢复!`)) return;
    setDeleting(true);
    const { error } = await supabase.rpc("admin_delete_user", {
      p_user_id: item.user_id,
    });
    setDeleting(false);
    if (error) {
      alert("删除失败:" + error.message);
    } else {
      onDelete(item.user_id);
      onClose();
    }
  };

  const inputCls =
    "w-full border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] transition-colors placeholder:text-[var(--umx-text-dim)]";
  const labelCls =
    "font-display text-[11px] font-bold text-white uppercase tracking-wider block";
  const selectCls =
    "w-full appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--umx-white)] outline-none focus:border-[var(--umx-acid)] cursor-pointer";

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex h-full w-[450px] max-w-full flex-col border-l border-[var(--umx-line)] bg-[var(--umx-bg-1)] shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[var(--umx-line)] px-6 py-5 bg-[var(--umx-bg-0)]">
          <div className="flex items-center gap-2">
            <UserCheck size={20} className="text-[var(--umx-acid)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--umx-white)] uppercase">EDIT USER PROFILE</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center border border-[var(--umx-line)] text-[var(--umx-text-dim)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)] transition-colors"
            style={{ borderRadius: "2px" }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 umx-scrollbar">
          {/* User ID info */}
          <div className="border border-[var(--umx-line)] bg-black/20 p-4 font-mono text-[10px] space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">USER ID:</span>
              <span className="text-[var(--umx-text-dim)] select-all">{item.user_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--umx-text-dim)] uppercase">REGISTERED AT:</span>
              <span className="text-[var(--umx-silver)]">{formatDate(item.registered_at)}</span>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className={labelCls}>登录邮箱 (EMAIL)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={{ borderRadius: "2px" }} />
          </div>

          {/* Name + Wechat */}
          <div className="space-y-2">
            <label className={labelCls}>姓名 (NAME)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="未填写" className={inputCls} style={{ borderRadius: "2px" }} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>微信昵称 (WECHAT)</label>
            <input value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="未填写" className={inputCls} style={{ borderRadius: "2px" }} />
          </div>

          {/* Department Select */}
          <div className="space-y-2">
            <label className={labelCls}>分配部门 (DEPARTMENT)</label>
            <div className="relative">
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={selectCls} style={{ borderRadius: "2px" }}>
                {DEPTS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Role Select */}
          <div className="space-y-2">
            <label className={labelCls}>分配角色 (ROLE)</label>
            <div className="relative">
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls} style={{ borderRadius: "2px" }}>
                {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Region Select */}
          <div className="space-y-2">
            <label className={labelCls}>所属地区 (REGION)</label>
            <div className="relative">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls} style={{ borderRadius: "2px" }}>
                {REGIONS.map((reg) => (<option key={reg} value={reg}>{reg}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--umx-text-dim)] pointer-events-none" />
            </div>
          </div>

          {/* Finance access toggle */}
          <button
            onClick={() => setFinanceAccess((v) => !v)}
            className="flex w-full items-center justify-between border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-4 py-3 transition-colors hover:border-[var(--umx-acid)]"
            style={{ borderRadius: "2px" }}
          >
            <span className="flex items-center gap-2 font-display text-[11px] font-bold text-white uppercase tracking-wider">
              <Wallet className="size-3.5 text-[var(--umx-acid)]" />
              财务工作台访问权 (FINANCE)
            </span>
            <span
              className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider border"
              style={financeAccess
                ? { color: "var(--umx-acid)", borderColor: "rgba(218,252,8,0.4)", background: "rgba(218,252,8,0.06)", borderRadius: "2px" }
                : { color: "var(--umx-text-dim)", borderColor: "var(--umx-line)", borderRadius: "2px" }}
            >
              {financeAccess ? "GRANTED" : "DENIED"}
            </span>
          </button>

          {/* Save / Cancel */}
          <div className="pt-4 border-t border-[var(--umx-line)] flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-[var(--umx-line)] hover:border-white font-mono text-[10px] uppercase tracking-widest text-[var(--umx-silver)] transition-all font-bold"
              style={{ borderRadius: "2px" }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 font-mono text-[10px] uppercase tracking-widest text-black bg-[var(--umx-acid)] hover:bg-white disabled:bg-[var(--umx-line)] disabled:text-[var(--umx-text-dim)] transition-all font-bold"
              style={{ borderRadius: "2px", cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "SAVING..." : "保存变更"}
            </button>
          </div>

          {/* Reset password */}
          <div className="space-y-2 border-t border-[var(--umx-line)] pt-5">
            <h5 className="flex items-center gap-1.5 font-display text-[11px] font-bold text-white uppercase tracking-wider">
              <KeyRound className="size-3.5 text-[var(--umx-acid)]" />
              重置密码 (RESET PASSWORD)
            </h5>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码(至少 6 位)"
              className={inputCls}
              style={{ borderRadius: "2px" }}
            />
            <button
              onClick={handleResetPassword}
              disabled={resetting || newPassword.length < 6}
              className="flex w-full items-center justify-center gap-1.5 py-2.5 border border-[var(--umx-line)] hover:border-[var(--umx-acid)] hover:text-[var(--umx-acid)] font-mono text-[10px] uppercase tracking-widest text-[var(--umx-silver)] disabled:opacity-40 transition-all font-bold"
              style={{ borderRadius: "2px", cursor: resetting || newPassword.length < 6 ? "not-allowed" : "pointer" }}
            >
              {resetting ? "RESETTING..." : "确认重置密码"}
            </button>
          </div>

          {/* Danger zone */}
          <div className="space-y-2 border-t border-[var(--umx-line)] pt-5">
            <h5 className="flex items-center gap-1.5 font-display text-[11px] font-bold text-[#ff6b6b] uppercase tracking-wider">
              <Trash2 className="size-3.5" />
              危险操作 (DANGER ZONE)
            </h5>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-1.5 py-2.5 border font-mono text-[10px] uppercase tracking-widest disabled:opacity-40 transition-all font-bold"
              style={{
                borderRadius: "2px",
                color: "#ff6b6b",
                borderColor: "rgba(255,107,107,0.4)",
                background: "rgba(255,107,107,0.06)",
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "DELETING..." : "永久删除该用户"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
```

- [ ] **Step 2: 主组件接线**。`handleUserSave`(约 line 1436)旁边加:

```tsx
const handleUserDelete = (userId: string) => {
  setUsersData((prev) => prev.filter((u) => u.user_id !== userId));
};
```

`<UserEditDrawer ...>` 调用处(约 line 2253)加 prop:

```tsx
<UserEditDrawer
  item={selectedUser}
  onClose={() => setSelectedUser(null)}
  onSave={handleUserSave}
  onDelete={handleUserDelete}
/>
```

- [ ] **Step 3: 编译验证**

```powershell
cd frontend/agent-chat-ui; npm run build
```

Expected: 编译通过。

- [ ] **Step 4: Commit**

```powershell
git add frontend/agent-chat-ui/src/app/admin/page.tsx
git commit -m "feat(admin): 编辑抽屉支持改邮箱/重置密码/姓名昵称/finance 开关/删除用户"
```

---

### Task 5: finance gate 切换为 finance_access

**Files:**
- Modify: `frontend/agent-chat-ui/src/app/finance/layout.tsx`
- Modify: `frontend/agent-chat-ui/src/app/profile/page.tsx`

- [ ] **Step 1: `finance/layout.tsx`** 四处修改:

类型(line 15-19)加字段:

```tsx
type FinanceProfile = {
  user_id: string;
  dept: string | null;
  role: string | null;
  finance_access: boolean | null;
};
```

查询(line 143-147)的 select 改为:

```tsx
      const { data } = await supabase
        .from("profiles")
        .select("user_id, dept, role, finance_access")
        .eq("user_id", user.id)
        .maybeSingle();
```

gate 判断(line 161-162)改为:

```tsx
  const isFinance =
    profile?.finance_access === true || profile?.role === "系统管理员";
```

`FinanceForbidden` 文案(line 97-100)改为:

```tsx
      <p className="mb-1 max-w-md font-body text-sm leading-relaxed text-[var(--umx-silver)]">
        财务工作台仅向 <span className="text-[var(--umx-acid)]">获授权用户</span> 与{" "}
        <span className="text-[var(--umx-acid)]">系统管理员</span> 开放。
      </p>
```

- [ ] **Step 2: `profile/page.tsx`** 三处修改:

`ProfileRow` 类型(line 36-43)加字段:

```tsx
type ProfileRow = {
  user_id: string;
  dept: string | null;
  role: string | null;
  region: string | null;
  name: string | null;
  wechat_nickname: string | null;
  finance_access: boolean | null;
};
```

profiles 查询(line 520-524)的 select 改为:

```tsx
        .select("user_id, dept, role, region, name, wechat_nickname, finance_access")
```

`FinanceCard`(line 488-490)判断改为(注释同步更新):

```tsx
/* ── Finance entry (only visible to 获授权用户 / 系统管理员) ────── */

function FinanceCard({ profile }: { profile: ProfileRow | null }) {
  const isFinance =
    profile?.finance_access === true || profile?.role === "系统管理员";
  if (!isFinance) return null;
```

- [ ] **Step 3: 编译验证**

```powershell
cd frontend/agent-chat-ui; npm run build
```

Expected: 编译通过。

- [ ] **Step 4: Commit**

```powershell
git add frontend/agent-chat-ui/src/app/finance/layout.tsx frontend/agent-chat-ui/src/app/profile/page.tsx
git commit -m "feat(finance): 访问 gate 切换为独立 finance_access 开关"
```

---

### Task 6: 端到端手工验证

前置:Task 2 迁移已生效。本地起 dev(`cd frontend/agent-chat-ui; npm run dev`,dev 模式自动把 /auth /rest 代理到 Kong;如直接验生产,需按 `infra/Dockerfile.frontend` 头部注释重新 build + 部署镜像)。

- [ ] **Step 1:** 用系统管理员账号登录 → `/admin` → 用户管理 tab → 「新建用户」建一个测试账号(不勾 finance)→ 列表出现该用户
- [ ] **Step 2:** 退出,用测试账号登录 → `/profile` 看不到 §05 FINANCE 入口,直接访问 `/finance` 显示 ACCESS DENIED
- [ ] **Step 3:** 切回管理员 → 编辑该用户,打开 finance 开关保存 → 测试账号刷新后 `/finance` 可进、§05 入口出现;关掉开关 → 再次被拦
- [ ] **Step 4:** 管理员给测试账号重置密码 → 测试账号旧密码登录失败、新密码成功
- [ ] **Step 5:** 管理员改测试账号邮箱 → 新邮箱可登录
- [ ] **Step 6:** 管理员编辑姓名/微信昵称保存 → 测试账号 `/profile` §01 能看到
- [ ] **Step 7:** 原财务部老用户(回填)确认仍能进 `/finance`
- [ ] **Step 8:** 删除测试用户 → 列表消失、该账号登录报错;在自己的编辑抽屉里点删除 → 提示「不能删除自己」
- [ ] **Step 9:** 全部通过后,若需要上生产:按 `infra/Dockerfile.frontend` 注释 build 静态包 + 镜像并部署
