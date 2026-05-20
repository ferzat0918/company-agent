import asyncio
import os
import psycopg

async def main():
    uri = os.environ.get("POSTGRES_URI", "postgres://postgres:dev-dev-dev-dev-dev-2026!!@localhost:5432/postgres")
    try:
        conn = await psycopg.AsyncConnection.connect(uri)
        async with conn:
            async with conn.cursor() as cur:
                # Get profiles columns
                await cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'profiles';
                """)
                cols = await cur.fetchall()
                print("--- Profiles Table Columns ---")
                for col in cols:
                    print(f"Column: {col[0]}, Type: {col[1]}, Nullable: {col[2]}")
                
                # Check how many profiles there are
                await cur.execute("SELECT COUNT(*) FROM public.profiles;")
                count = (await cur.fetchone())[0]
                print(f"\nTotal rows in profiles: {count}")
                
                # Check auth.users table
                await cur.execute("SELECT COUNT(*) FROM auth.users;")
                auth_count = (await cur.fetchone())[0]
                print(f"Total rows in auth.users: {auth_count}")

                if auth_count > 0:
                    await cur.execute("SELECT id, email, created_at FROM auth.users;")
                    users = await cur.fetchall()
                    print("\n--- Registered Users in auth.users ---")
                    for user in users:
                        print(f"ID: {user[0]}, Email: {user[1]}, Created: {user[2]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
