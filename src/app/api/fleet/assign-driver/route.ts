import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const db = getAdminClient();
  const { data } = await db.auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data: owner } = await db
    .from("Owner")
    .select("id, status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!owner || owner.status !== "ACTIVE") {
    return Response.json({ data: null, error: "Owner account required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { vehicle_id, driver_profile_id } = body as {
    vehicle_id?: string; driver_profile_id?: string | null;
  };
  if (!vehicle_id) return Response.json({ data: null, error: "vehicle_id required" }, { status: 400 });

  const { data: vehicle } = await db
    .from("Vehicle")
    .select("id")
    .eq("id", vehicle_id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (!vehicle) return Response.json({ data: null, error: "Vehicle not found" }, { status: 404 });

  // Conflict check: prevent silent overwrite of an existing driver assignment
  const { data: currentVehicle } = await db
    .from("Vehicle")
    .select("driver_id")
    .eq("id", vehicle_id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (currentVehicle?.driver_id && currentVehicle.driver_id !== driver_profile_id) {
    return Response.json({ data: null, error: "Vehicle already assigned to another driver" }, { status: 409 });
  }

  // Validate driver belongs to this owner's fleet
  if (driver_profile_id) {
    const { data: dp } = await db
      .from("DriverProfile")
      .select("id")
      .eq("id", driver_profile_id)
      .eq("owner_id", owner.id)
      .maybeSingle();
    if (!dp) return Response.json({ data: null, error: "Driver not in your fleet" }, { status: 403 });
  }

  try {
    const { data: updated, error } = await db
      .from("Vehicle")
      .update({ driver_id: driver_profile_id ?? null })
      .eq("id", vehicle_id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ data: updated, error: null });
  } catch (err) {
    console.error("[fleet/assign-driver]", err);
    return Response.json({ data: null, error: "Failed to assign driver" }, { status: 500 });
  }
}
