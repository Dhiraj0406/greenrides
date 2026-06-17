import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getAdminClient();

  const { data: { user: authUser } } = await db.auth.getUser(token);
  if (!authUser) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const { data: ride, error: rideErr } = await db
      .from("Ride")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (rideErr) throw rideErr;
    if (!ride) {
      return Response.json({ data: null, error: "Ride not found" }, { status: 404 });
    }

    const [driverRes, driverProfileRes, bookingsRes] = await Promise.all([
      db.from("User").select("id, name, phone, avatar_url").eq("id", ride.driver_id).maybeSingle(),
      db.from("DriverProfile").select("vehicle_type, vehicle_number, vehicle_model, avg_rating, total_trips").eq("user_id", ride.driver_id).maybeSingle(),
      db.from("Booking").select("id, status, seats, pickup_point, amount_paise, rider_id").eq("ride_id", id),
    ]);

    const bookingsRaw = bookingsRes.data ?? [];
    const riderIds = [...new Set(bookingsRaw.map((b: { rider_id: string }) => b.rider_id))];
    let riderMap = new Map<string, { name: string; phone: string }>();

    if (riderIds.length > 0) {
      const { data: riders } = await db.from("User").select("id, name, phone").in("id", riderIds);
      riderMap = new Map((riders ?? []).map((r: { id: string; name: string; phone: string }) => [r.id, r]));
    }

    const isDriver = authUser.id === ride.driver_id;
    const bookings = bookingsRaw.map((b: { rider_id: string; [key: string]: unknown }) => ({
      ...b,
      rider_name:  riderMap.get(b.rider_id)?.name  ?? "Rider",
      rider_phone: isDriver ? (riderMap.get(b.rider_id)?.phone ?? "") : "",
    }));

    const data = {
      ...ride,
      driver: {
        ...driverRes.data,
        driver_profile: driverProfileRes.data,
      },
      bookings,
    };

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[rides/[id] GET]", err);
    return Response.json({ data: null, error: "Failed to fetch ride" }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { status: newStatus } = parsed.data;

  const { data: ride } = await db
    .from("Ride")
    .select("driver_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!ride) return Response.json({ data: null, error: "Ride not found" }, { status: 404 });
  if (ride.driver_id !== user.id) return Response.json({ data: null, error: "Forbidden" }, { status: 403 });

  const validTransitions: Record<string, string> = {
    IN_PROGRESS: "SCHEDULED",
    COMPLETED:   "IN_PROGRESS",
  };

  if (ride.status !== validTransitions[newStatus]) {
    return Response.json({ data: null, error: `Cannot transition from ${ride.status} to ${newStatus}` }, { status: 409 });
  }

  try {
    const { error: updateErr } = await db.from("Ride").update({ status: newStatus }).eq("id", id);
    if (updateErr) throw updateErr;

    if (newStatus === "COMPLETED") {
      await db.from("Booking").update({ status: "COMPLETED" }).eq("ride_id", id).eq("status", "CONFIRMED");

      const { data: dp } = await db.from("DriverProfile").select("total_trips").eq("user_id", user.id).maybeSingle();
      await db.from("DriverProfile")
        .update({ total_trips: (dp?.total_trips ?? 0) + 1 })
        .eq("user_id", user.id);
    }

    return Response.json({ data: { status: newStatus }, error: null });
  } catch (err) {
    console.error("[rides/[id] PATCH]", err);
    return Response.json({ data: null, error: "Failed to update ride" }, { status: 500 });
  }
}
