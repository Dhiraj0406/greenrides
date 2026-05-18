import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

// Browser client — uses cookie storage so proxy.ts can read the session server-side.
// createBrowserClient (from @supabase/ssr) stores the JWT as an sb-*-auth-token cookie
// instead of localStorage, which is what the proxy gate checks for.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL    || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

// Server-only admin client (service role — bypasses RLS)
// Import this only in server components / API routes, never in client code
export function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
