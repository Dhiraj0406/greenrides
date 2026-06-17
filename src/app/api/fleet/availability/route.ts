import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data: profile, error } = await db
    .from("DriverProfile")
    .select("is_online, vehicle_type, vehicle_number, vehicle_model, license_number, availability, is_approved")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[fleet/availability GET]", error);
    return Response.json({ data: null, error: "Failed to fetch availability" }, { status: 500 });
  }
  if (!profile || !profile.is_approved) {
    return Response.json({ data: null, error: "Not a driver" }, { status: 403 });
  }

  return Response.json({
    data: {
      is_online:      profile.is_online,
      vehicle_type:   profile.vehicle_type,
      vehicle_number: profile.vehicle_number,
      vehicle_model:  profile.vehicle_model,
      license_number: profile.license_number,
      availability:   (profile.availability as Record<string, string>) ?? {},
    },
    error: null,
  });
}

export async function PATCH(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { is_online, availability } = body as { is_online?: boolean; availability?: Record<string, string> };

  if (typeof is_online !== "boolean" && availability === undefined) {
    return Response.json({ data: null, error: "is_online (boolean) or availability (object) required" }, { status: 400 });
  }

  const { data: profile, error: fetchErr } = await db
    .from("DriverProfile")
    .select("is_approved")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !profile || !profile.is_approved) {
    return Response.json({ data: null, error: "Not a driver" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof is_online === "boolean") updateData.is_online = is_online;
  if (availability !== undefined) updateData.availability = availability;

  const { error: updateErr } = await db
    .from("DriverProfile")
    .update(updateData)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[fleet/availability PATCH]", updateErr);
    return Response.json({ data: null, error: "Failed to update availability" }, { status: 500 });
  }

  return Response.json({ data: updateData, error: null });
}
