// Server-only: uses the Supabase service_role key, which bypasses RLS.
// Never import this file from a "use client" component or any code that
// could end up in the browser bundle — only from Route Handlers / other
// server-only code.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Supabase-Server-Konfiguration fehlt. SUPABASE_SERVICE_ROLE_KEY in .env.local setzen (siehe .env.example)."
  );
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
