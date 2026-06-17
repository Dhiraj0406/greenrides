import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data: profile, error } = await db
    .from("DriverProfile")
    .select("*, user:user_id(name, phone)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[fleet/driver/profile GET]", error);
    return Response.json({ data: null, error: "Failed to fetch profile" }, { status: 500 });
  }
  if (!profile) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  const u = profile.user as { name: string | null; phone: string } | null;

  return Response.json({
    data: {
      name:           u?.name ?? null,
      phone:          u?.phone ?? null,
      vehicle_type:   profile.vehicle_type,
      vehicle_number: profile.vehicle_number,
      vehicle_model:  profile.vehicle_model,
      license_number: profile.license_number,
      avg_rating:     profile.avg_rating,
      total_trips:    profile.total_trips,
      is_online:      profile.is_online,
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

  const body = await req.json().catch(() => ({})) as {
    vehicle_type?: string; vehicle_number?: string;
    vehicle_model?: string; license_number?: string; name?: string;
  };

  const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.vehicle_type)   profileUpdate.vehicle_type   = body.vehicle_type;
  if (body.vehicle_number) profileUpdate.vehicle_number = body.vehicle_number.toUpperCase();
  if (body.vehicle_model)  profileUpdate.vehicle_model  = body.vehicle_model;
  if (body.license_number) profileUpdate.license_number = body.license_number.toUpperCase();

  try {
    if (Object.keys(profileUpdate).length > 1) {
      const { error } = await db.from("DriverProfile").update(profileUpdate).eq("user_id", user.id);
      if (error) throw error;
    }
    if (body.name) {
      const { error } = await db.from("User").update({ name: body.name, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) throw error;
    }
    return Response.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error("[fleet/driver/profile PATCH]", err);
    return Response.json({ data: null, error: "Failed to update profile" }, { status: 500 });
  }
}
