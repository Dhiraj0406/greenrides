import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

async function getOwner(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: owner } = await db
    .from("Owner")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return owner;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getAdminClient();

  const { data: vehicle } = await db
    .from("Vehicle")
    .select("id")
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (!vehicle) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { active, driver_id } = body as { active?: boolean; driver_id?: string | null };

  const updateData: Record<string, unknown> = {};
  if (active !== undefined) updateData.active = active;
  if (driver_id !== undefined) updateData.driver_id = driver_id;

  try {
    const { data: updated, error } = await db
      .from("Vehicle")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ data: updated, error: null });
  } catch (err) {
    console.error("[fleet/vehicles/:id PATCH]", err);
    return Response.json({ data: null, error: "Failed to update vehicle" }, { status: 500 });
  }
}
