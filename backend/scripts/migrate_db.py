import asyncio
import os
import psycopg

async def migrate(uri: str, name: str):
    print(f"\n==================================================")
    print(f"Migrating {name} database...")
    print(f"URI target: {uri.split('@')[-1]}")
    try:
        conn = await psycopg.AsyncConnection.connect(uri)
        async with conn:
            async with conn.cursor() as cur:
                # First check if the feedback table even exists
                await cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                          AND table_name = 'feedback'
                    );
                """)
                table_exists = (await cur.fetchone())[0]
                if not table_exists:
                    print(f"Feedback table does not exist in {name}! Skipping table column migration.")
                    return

                # Check existing columns
                await cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'feedback';
                """)
                columns = [row[0] for row in await cur.fetchall()]
                print(f"Current columns in {name}.feedback: {columns}")
                
                # Check for attachments column
                if 'attachments' not in columns:
                    print("Adding 'attachments' column...")
                    await cur.execute("ALTER TABLE public.feedback ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;")
                else:
                    print("'attachments' column already exists.")
                    
                # Check for admin_note column
                if 'admin_note' not in columns:
                    print("Adding 'admin_note' column...")
                    await cur.execute("ALTER TABLE public.feedback ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';")
                else:
                    print("'admin_note' column already exists.")
                
                await conn.commit()
            print(f"Migration successful for {name}!")
    except Exception as e:
        print(f"ERROR while migrating {name}: {e}")

async def main():
    local_uri = os.environ.get("POSTGRES_URI", "postgres://postgres:dev-dev-dev-dev-dev-2026!!@localhost:5432/postgres")
    remote_uri = "postgres://postgres:dev-dev-dev-dev-dev-2026!!@192.168.1.100:5432/postgres"
    
    # Run both migrations
    await migrate(local_uri, "Local")
    await migrate(remote_uri, "Remote")

if __name__ == "__main__":
    asyncio.run(main())
