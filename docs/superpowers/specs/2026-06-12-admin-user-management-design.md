# Admin 页用户管理 + 独立 finance 权限 — 设计文档

日期:2026-06-12
状态:已确认

## 背景与目标

目前添加用户只能走 Supabase dashboard;admin 页用户管理 tab 只能改 部门/角色/区域。
finance 页(`/finance/*`)的访问权是推导式的:`dept = '财务部' OR role = '系统管理员'`。

目标:

1. 在 admin 页直接 **新建用户**(管理员设初始密码,邮箱即时标记已验证,不依赖 SMTP)
2. 在 admin 页编辑用户 **全部信息**:邮箱、密码重置、姓名、微信昵称、部门、角色、区域
3. 支持 **删除用户**(二次确认,禁止删自己)
4. finance 访问权改为 **独立开关** `profiles.finance_access`,admin 页可单独勾选,任何部门的人都可被授权

## 架构决策

生产前端是 Next.js 静态导出 + nginx,没有 Node 服务端;浏览器 anon key 无权写 `auth.users`。

选定方案:**数据库 SECURITY DEFINER RPC**(通过 PostgREST `supabase.rpc()` 调用)。

- 零新增基础设施,与项目现有「一切走 PostgREST + RLS」模式一致(复用 `is_system_admin()` 守门)
- 密码用 pgcrypto `crypt(pwd, gen_salt('bf'))` 哈希后直接写 `auth.users` + `auth.identities`
- 已知坑:`auth.users` 的 `confirmation_token` 等 token 字段必须写 `''` 而非 NULL,否则 GoTrue 扫描报错

否决的备选:后端 Python 加 admin API 调 GoTrue 官方接口(要新增后端路由 + JWT 校验 + nginx 代理,违背最小路径);前端直连 GoTrue admin API(service key 暴露浏览器,不安全)。

## 1. 数据库迁移 `infra/migrations/0004_admin_user_management.sql`

全部幂等,可重复执行。

### 1.1 finance 独立开关

- `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS finance_access boolean DEFAULT false;`
- 回填:`UPDATE profiles SET finance_access = true WHERE dept = '财务部'`(保证切换模型时无人丢权限;只在该列刚创建时执行一次性回填,幂等处理)
- 重建 `fin_is_finance_user()` 函数体:`finance_access = true OR role = '系统管理员'`(fin_* 四张表的 policy 引用此函数,无需改动)
- 重建 `admin_user_view`,新增 `finance_access` 列

### 1.2 四个 RPC 函数

公共约定:`SECURITY DEFINER`、`SET search_path = public, auth, extensions`、函数体第一步 `IF NOT public.is_system_admin() THEN RAISE EXCEPTION '仅系统管理员可操作'; END IF;`、`REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`。错误一律 `RAISE EXCEPTION` 中文消息,由前端 alert 透出。

| 函数 | 签名 | 行为 |
|---|---|---|
| `admin_create_user` | `(p_email text, p_password text, p_dept text, p_role text, p_region text, p_name text, p_wechat_nickname text, p_finance_access boolean) RETURNS uuid` | 校验:邮箱格式、邮箱未被占用(`邮箱已被注册`)、密码 ≥ 6 位(`密码至少 6 位`)。写 `auth.users`:`instance_id='00000000-0000-0000-0000-000000000000'`、`aud='authenticated'`、`role='authenticated'`、`encrypted_password=crypt(...)`、`email_confirmed_at=now()`、`raw_app_meta_data='{"provider":"email","providers":["email"]}'`、`raw_user_meta_data='{}'`、token 字段全部 `''`。写 `auth.identities`(`provider='email'`、`provider_id=user_id`、`identity_data` 含 sub/email)。已有 `on_auth_user_created` 触发器自动建 profile,随后 UPDATE profile 补全 dept/role/region/name/wechat_nickname/finance_access。返回新 user_id |
| `admin_update_user_email` | `(p_user_id uuid, p_new_email text) RETURNS void` | 校验新邮箱未被他人占用;更新 `auth.users.email` 及 `auth.identities.identity_data` 中的 email |
| `admin_reset_password` | `(p_user_id uuid, p_new_password text) RETURNS void` | 校验 ≥ 6 位;更新 `encrypted_password = crypt(...)` |
| `admin_delete_user` | `(p_user_id uuid) RETURNS void` | `p_user_id = auth.uid()` 时报 `不能删除自己`;`DELETE FROM auth.users`,profiles(FK CASCADE)与 identities 级联删除 |

姓名/微信昵称/finance_access 的日常编辑不走 RPC,直接走 `profiles` 表(现有 `profiles_admin_write` RLS 已覆盖)。

## 2. admin 页前端(`frontend/agent-chat-ui/src/app/admin/page.tsx`)

- `UserViewRow` 类型补 `name`、`wechat_nickname`、`finance_access` 字段(视图里已有/新增)
- 用户管理 tab 顶部加「新建用户」按钮 → 新建抽屉(复用现有抽屉视觉风格):邮箱、初始密码、姓名、微信昵称、部门、角色、区域、finance 开关 → `supabase.rpc("admin_create_user", …)` → 成功后刷新列表并关闭
- `UserEditDrawer` 扩展:
  - 邮箱从只读改为可编辑 + 保存(RPC `admin_update_user_email`)
  - 「重置密码」输入框 + 按钮(RPC `admin_reset_password`)
  - 姓名、微信昵称输入框(随 dept/role/region 一起 `profiles` upsert)
  - finance 访问开关(同上走 profiles)
  - 底部「删除用户」红色按钮,二次确认后调 RPC `admin_delete_user`,成功后从列表移除
- 用户列表行加 finance 权限标识(有权限的显示 acid 色小标)

## 3. finance gate 同步切换

- `frontend/agent-chat-ui/src/app/finance/layout.tsx`:查询 profiles 时带上 `finance_access`,gate 条件改为 `finance_access === true || role === '系统管理员'`;无权提示文案从「仅向财务部…」改为「仅向获授权用户与系统管理员开放」
- `frontend/agent-chat-ui/src/app/profile/page.tsx` §05 财务入口:显示条件同样改为 `finance_access || role === '系统管理员'`

## 4. 部署与验证

- 迁移 SQL 通过 pg-meta `/query`(192.168.1.100)打到生产库,文件同时进 git
- 手工验证清单:
  1. admin 页新建用户 → 用新账号登录成功
  2. 新账号默认无 finance 权限 → `/finance` 被拦;admin 勾选开关后放行;取消后再次被拦
  3. 原财务部用户回填后仍能进 `/finance`
  4. 重置密码 → 旧密码失效、新密码可登录
  5. 改邮箱 → 新邮箱可登录
  6. 删除用户 → 列表消失、该账号无法登录;尝试删自己 → 报错
  7. 普通用户直接调 RPC(curl)→ 被 `is_system_admin()` 拒绝

## 范围外

- 邮件邀请流程(需 SMTP,暂不做)
- 通用权限数组 / 更多模块的权限位(YAGNI,等有第二个模块再说)
- 禁用(soft-ban)用户,只做硬删除
