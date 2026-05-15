import { createClient } from "@supabase/supabase-js";

// Same-origin by default: the browser uses whatever host loaded the page,
// so the frontend works on any deployment (LAN IP, public domain, etc.)
// without rebuilding. The env override is kept for backward compat.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
