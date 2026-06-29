import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data: owner } = await db
    .from("Owner")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!owner) return Response.json({ data: null, error: "Not an owner" }, { status: 403 });

  try {
    // Get vehicles that have an assigned driver
    const { data: vehicles, error: vehiclesErr } = await db
      .from("Vehicle")
      .select("driver_id")
      .eq("owner_id", owner.id)
      .not("driver_id", "is", null);

    if (vehiclesErr) throw vehiclesErr;

    const driverProfileIds = (vehicles ?? [])
      .map((v: { driver_id: string | null }) => v.driver_id)
      .filter(Boolean) as string[];

    let bookings: unknown[] = [];
    if (driverProfileIds.length > 0) {
      // Get user_ids from driver profiles
      const { data: profiles, error: profilesErr } = await db
        .from("DriverProfile")
        .select("user_id")
        .in("id", driverProfileIds);

      if (profilesErr) throw profilesErr;

      const driverUserIds = (profiles ?? []).map((p: { user_id: string }) => p.user_id);

      if (driverUserIds.length > 0) {
        // Get rides driven by these users
        const { data: rides, error: ridesErr } = await db
          .from("Ride")
          .select("id")
          .in("driver_id", driverUserIds);

        if (ridesErr) throw ridesErr;

        const rideIds = (rides ?? []).map((r: { id: string }) => r.id);

        if (rideIds.length > 0) {
          const { data: bookingsData, error: bookingsErr } = await db
            .from("Booking")
            .select("id, amount_paise, status, created_at, ride_id, Ride!ride_id(from_city, to_city, departure_time)")
            .in("ride_id", rideIds)
            .in("status", ["COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(100);

          if (bookingsErr) throw bookingsErr;
          bookings = bookingsData ?? [];
        }
      }
    }

    const { data: payouts } = await db
      .from("OwnerPayout")
      .select("*")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false });

    const totalEarned = (bookings as Array<{ amount_paise: number }>)
      .reduce((s, b) => s + (Number(b.amount_paise) || 0), 0);

    return Response.json({ data: { bookings, payouts: payouts ?? [], totalEarned }, error: null });
  } catch (err) {
    console.error("[fleet/earnings GET]", err);
    return Response.json({ data: null, error: "Failed to fetch earnings" }, { status: 500 });
  }
}
