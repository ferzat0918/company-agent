import asyncio
import os
import psycopg

async def main():
    uri = os.environ.get("POSTGRES_URI", "postgres://postgres:dev-dev-dev-dev-dev-2026!!@localhost:5432/postgres")
    print(f"Connecting to database at {uri.split('@')[-1]}...")
    
    sql_script = """
    -- 1. Insert profiles for pre-existing auth.users
    INSERT INTO public.profiles (user_id, dept, role, region, name, wechat_nickname, created_at)
    SELECT id, '未分配', '普通用户', '未分配', '', '', now()
    FROM auth.users
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. Create function and trigger for automatic profile generation on user signup
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (user_id, dept, role, region, name, wechat_nickname, created_at)
      VALUES (new.id, '未分配', '普通用户', '未分配', '', '', now())
      ON CONFLICT (user_id) DO NOTHING;
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Recreate trigger to be safe
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- 3. Create a secure view for administrators to view and search user emails
    CREATE OR REPLACE VIEW public.admin_user_view AS
    SELECT 
      u.id AS user_id,
      u.email,
      u.created_at AS registered_at,
      COALESCE(p.dept, '未分配') AS dept,
      COALESCE(p.role, '普通用户') AS role,
      COALESCE(p.region, '未分配') AS region,
      COALESCE(p.name, '') AS name,
      COALESCE(p.wechat_nickname, '') AS wechat_nickname
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id;

    -- 4. Grant table and view permissions for authentication roles
    GRANT ALL ON public.profiles TO authenticated;
    GRANT ALL ON public.profiles TO anon;
    
    GRANT SELECT ON public.admin_user_view TO authenticated;
    GRANT SELECT ON public.admin_user_view TO anon;
    """
    
    try:
        conn = await psycopg.AsyncConnection.connect(uri)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute(sql_script)
                await conn.commit()
            print("Successfully completed database migration for User Profiles and Admin Views!")
    except Exception as e:
        print(f"ERROR during profiles migration: {e}")

if __name__ == "__main__":
    asyncio.run(main())
