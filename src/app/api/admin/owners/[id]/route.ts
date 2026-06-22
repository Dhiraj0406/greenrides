import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id }     = await params;
  const body       = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!["ACTIVE", "SUSPENDED"].includes(status ?? "")) {
    return Response.json({ data: null, error: "status must be ACTIVE or SUSPENDED" }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("Owner")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    `owner_${status === "ACTIVE" ? "activated" : "suspended"}`,
      entity:    "owner",
      entity_id: id,
      details:   { status },
    });

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/owners/:id PATCH]", err);
    return Response.json({ data: null, error: "Failed to update owner" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const db = getAdminClient();
    const { data: owner } = await db.from("Owner").select("user_id, name").eq("id", id).single();
    if (!owner) return Response.json({ data: null, error: "Owner not found" }, { status: 404 });

    // Suspend rather than hard-delete (Vehicle/Payout FKs would break)
    await db.from("Owner").update({ status: "SUSPENDED" }).eq("id", id);

    // Remove "owner" role from app_metadata
    const { data: authData } = await db.auth.admin.getUserById(owner.user_id);
    if (authData?.user) {
      const existingMeta  = authData.user.app_metadata ?? {};
      const existingRoles = (existingMeta.roles as string[] | undefined) ?? [];
      const newRoles      = existingRoles.filter((r) => r !== "owner");
      await db.auth.admin.updateUserById(owner.user_id, {
        app_metadata: { ...existingMeta, roles: newRoles, fleet_status: newRoles.length > 0 ? "active" : "removed" },
      });
    }

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    "owner_removed",
      entity:    "owner",
      entity_id: id,
      details:   { name: owner.name, user_id: owner.user_id },
    });

    return Response.json({ data: { removed: true }, error: null });
  } catch (err) {
    console.error("[admin/owners/:id DELETE]", err);
    return Response.json({ data: null, error: "Remove failed" }, { status: 500 });
  }
}
