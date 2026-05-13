-- Run as supabase_admin to fix storage schema ownership
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
ALTER ROLE supabase_storage_admin WITH PASSWORD 'dev-dev-dev-dev-dev-2026!!';
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT USAGE ON SCHEMA extensions TO supabase_storage_admin;
GRANT CREATE ON DATABASE postgres TO supabase_storage_admin;
