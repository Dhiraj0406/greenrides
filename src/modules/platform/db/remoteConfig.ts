import { prisma } from "@/lib/prisma";

const cache = new Map<string, { value: boolean; expiresAt: number }>();

export async function getFlag(key: string, defaultValue: boolean): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const record = await prisma.appRemoteConfig.findUnique({ where: { key } });
    const value = record != null ? record.enabled : defaultValue;
    cache.set(key, { value, expiresAt: now + 60_000 });
    return value;
  } catch {
    return defaultValue;
  }
}

export function invalidateFlag(key: string): void {
  cache.delete(key);
}
