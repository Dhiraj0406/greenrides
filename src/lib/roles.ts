import { getAdminClient } from "@/lib/supabase";

export type FleetRole = "driver" | "owner" | "admin";

export function getRolesFromMetadata(appMetadata: Record<string, unknown>): string[] {
  const roles = appMetadata?.roles;
  if (Array.isArray(roles)) return roles as string[];
  return [];
}

export function hasFleetAccess(roles: string[]): boolean {
  return roles.includes("driver") || roles.includes("owner");
}

export function hasOwnerRole(roles: string[]): boolean {
  return roles.includes("owner");
}

export function hasDriverRole(roles: string[]): boolean {
  return roles.includes("driver");
}

export async function setUserRoles(
  userId: string,
  roles: string[],
  fleetStatus: "pending" | "active" | "suspended"
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { roles, fleet_status: fleetStatus },
  });
  if (error) throw new Error(`Failed to set roles: ${error.message}`);
}
