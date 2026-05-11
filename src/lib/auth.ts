import { createClient } from "@supabase/supabase-js";

export async function getServerSession() {
  // Returns the current user or null — uses cookies via Supabase SSR
  // Since we're using the basic client (no SSR package), use the anon client
  // This is a placeholder that returns null server-side for now
  // Client-side auth state is handled via supabase.auth.getUser() in components
  return null;
}
