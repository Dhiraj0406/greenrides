import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("DriverProfile")
      .select("id, commission_pct, vehicle_model, vehicle_number, user:User(name, phone)")
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ data: data ?? [], error: null });
  } catch (err) {
    console.error("[admin/commission GET]", err);
    return Response.json({ data: null, error: "Failed to fetch" }, { status: 500 });
  }
}

const patchSchema = z.object({
  driver_profile_id: z.string().uuid(),
  commission_pct:    z.number().min(0).max(100),
});

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const db = getAdminClient();
    const { data: prev } = await db
      .from("DriverProfile")
      .select("commission_pct")
      .eq("id", parsed.data.driver_profile_id)
      .single();

    const { data, error } = await db
      .from("DriverProfile")
      .update({ commission_pct: parsed.data.commission_pct })
      .eq("id", parsed.data.driver_profile_id)
      .select("id, commission_pct")
      .single();

    if (error) throw error;

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    "commission_updated",
      entity:    "driver",
      entity_id: parsed.data.driver_profile_id,
      details:   { from: prev?.commission_pct ?? null, to: parsed.data.commission_pct },
    });

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/commission PATCH]", err);
    return Response.json({ data: null, error: "Failed to update" }, { status: 500 });
  }
}
