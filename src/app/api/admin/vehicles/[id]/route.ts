import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body   = await req.json().catch(() => ({}));
  const parsed = z.object({ active: z.boolean() }).safeParse(body);
  if (!parsed.success) return Response.json({ data: null, error: "active (boolean) required" }, { status: 400 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("Vehicle")
      .update({ active: parsed.data.active })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    parsed.data.active ? "vehicle_activated" : "vehicle_deactivated",
      entity:    "vehicle",
      entity_id: id,
      details:   { active: parsed.data.active },
    });

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/vehicles/:id PATCH]", err);
    return Response.json({ data: null, error: "Update failed" }, { status: 500 });
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
    const { data: vehicle } = await db.from("Vehicle").select("make, model_name, number").eq("id", id).single();

    // Soft delete: deactivate and unlink driver
    const { error } = await db.from("Vehicle").update({ active: false, driver_id: null }).eq("id", id);
    if (error) throw error;

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    "vehicle_removed",
      entity:    "vehicle",
      entity_id: id,
      details:   { make: vehicle?.make, model_name: vehicle?.model_name, number: vehicle?.number },
    });

    return Response.json({ data: { removed: true }, error: null });
  } catch (err) {
    console.error("[admin/vehicles/:id DELETE]", err);
    return Response.json({ data: null, error: "Remove failed" }, { status: 500 });
  }
}
