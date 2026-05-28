import { getAdminClient } from "@/lib/supabase";

const cache = new Map<string, { value: boolean; expiresAt: number }>();

export async function getFlag(key: string, defaultValue: boolean): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const { data } = await getAdminClient()
      .from("app_remote_config")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    const value = data != null ? (data.enabled as boolean) : defaultValue;
    cache.set(key, { value, expiresAt: now + 60_000 });
    return value;
  } catch {
    return defaultValue;
  }
}

export function invalidateFlag(key: string): void {
  cache.delete(key);
}
