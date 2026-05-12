-- Create supabase_storage_admin role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN PASSWORD 'dev-dev-dev-dev-dev-2026!!';
  END IF;
END
$$;

-- Create storage schema if not exists
CREATE SCHEMA IF NOT EXISTS storage;

-- Grant permissions
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;

-- Also grant on public schema for migrations table
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT CREATE ON DATABASE postgres TO supabase_storage_admin;
