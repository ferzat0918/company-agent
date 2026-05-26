import { createClient } from "@supabase/supabase-js";

// Same-origin by default: the browser uses whatever host loaded the page,
// so the frontend works on any deployment (LAN IP, public domain, etc.)
// without rebuilding. The env override is kept for backward compat.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost");
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "dummy-key-for-build-time-static-prerender";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
