import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

// ─── GET /api/bookings ───────────────────────────────────────────────────────
// ?admin=1 + x-admin-token header → all bookings (admin panel)
// Authorization: Bearer <token>   → rider's own bookings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isAdmin = searchParams.get("admin") === "1";
  const db = getAdminClient();

  // ── Admin path ────────────────────────────────────────────────────────────
  if (isAdmin) {
    const token = req.headers.get("x-admin-token") ?? "";
    if (token !== process.env.ADMIN_SECRET) {
      return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    try {
      const { data: bookings, error } = await db
        .from("Booking")
        .select("id, status, amount_paise, seats, pickup_point, created_at, ride_id, rider_id, Ride!ride_id(from_city, to_city), rider:User!rider_id(name, phone)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return Response.json({ data: bookings ?? [], error: null });
    } catch (err) {
      console.error("[bookings GET admin]", err);
      return Response.json({ data: null, error: "Failed" }, { status: 500 });
    }
  }

  // ── Rider path (Bearer token auth) ────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData, error: authError } = await db.auth.getUser(token);
  if (authError || !userData.user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  try {
    const { data: bookingsRaw, error: bookingsErr } = await db
      .from("Booking")
      .select("id, status, amount_paise, pickup_point, seats, created_at, ride_id")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false });

    if (bookingsErr) throw bookingsErr;

    const bookings = bookingsRaw ?? [];
    const rideIds = [...new Set(bookings.map((b: { ride_id: string }) => b.ride_id))];

    if (rideIds.length === 0) {
      return Response.json({ data: [], error: null });
    }

    const { data: rides } = await db
      .from("Ride")
      .select("id, from_city, to_city, departure_time, driver_id")
      .in("id", rideIds);

    const rideMap = new Map((rides ?? []).map((r: { id: string; [key: string]: unknown }) => [r.id, r]));
    const driverIds = [...new Set((rides ?? []).map((r: { driver_id: string }) => r.driver_id))];

    let driverProfileMap = new Map<string, { vehicle_number?: string; vehicle_model?: string }>();
    let driverMap = new Map<string, { name?: string }>();

    if (driverIds.length > 0) {
      const [driversRes, profilesRes] = await Promise.all([
        db.from("User").select("id, name").in("id", driverIds),
        db.from("DriverProfile").select("user_id, vehicle_number, vehicle_model").in("user_id", driverIds),
      ]);
      driverMap = new Map((driversRes.data ?? []).map((d: { id: string; name: string }) => [d.id, d]));
      driverProfileMap = new Map((profilesRes.data ?? []).map((p: { user_id: string; vehicle_number?: string; vehicle_model?: string }) => [p.user_id, p]));
    }

    const bookingIds = bookings.map((b: { id: string }) => b.id);
    const { data: ratings } = await db
      .from("Rating")
      .select("booking_id")
      .in("booking_id", bookingIds)
      .eq("rater_id", userId);

    const ratedSet = new Set((ratings ?? []).map((r: { booking_id: string }) => r.booking_id));

    const data = bookings.map((b: { id: string; status: string; amount_paise: number; pickup_point: string; seats: number; created_at: string; ride_id: string }) => {
      const ride = rideMap.get(b.ride_id) as { from_city: string; to_city: string; departure_time: string; driver_id: string } | undefined;
      const driver = ride ? driverMap.get(ride.driver_id) : undefined;
      const profile = ride ? driverProfileMap.get(ride.driver_id) : undefined;
      return {
        id:             b.id,
        status:         b.status,
        amount_paise:   b.amount_paise,
        pickup_point:   b.pickup_point,
        seats:          b.seats,
        created_at:     b.created_at,
        from:           ride?.from_city ?? "",
        to:             ride?.to_city ?? "",
        departure_time: ride?.departure_time ?? "",
        driver_name:    driver?.name ?? "Driver",
        vehicle_number: profile?.vehicle_number ?? "",
        vehicle_model:  profile?.vehicle_model ?? "",
        has_rating:     ratedSet.has(b.id),
      };
    });

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[bookings GET rider]", err);
    return Response.json({ data: null, error: "Failed to fetch bookings" }, { status: 500 });
  }
}

// ─── POST /api/bookings ──────────────────────────────────────────────────────

const schema = z.object({
  ride_id:        z.string().uuid(),
  rider_id:       z.string().uuid(),
  seats:          z.number().int().min(1).max(6),
  pickup_point:   z.string().min(2),
  traveler_name:  z.string().min(1).max(100).optional(),
  traveler_phone: z.string().min(5).max(20).optional(),
  payment_method: z.enum(["cash", "razorpay"]).default("cash"),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
  const adminClient = getAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(bearerToken);
  if (authError || !authData.user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
  const authenticatedUserId = authData.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { ride_id, seats, pickup_point, traveler_name, traveler_phone, payment_method } = parsed.data;
  const rider_id = authenticatedUserId;

  try {
    const { data, error } = await (await import("@/lib/supabase")).supabase.rpc(
      "create_booking",
      {
        p_ride_id:  ride_id,
        p_rider_id: rider_id,
        p_seats:    seats,
        p_pickup:   pickup_point,
      }
    );

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("not enough seats")) {
        return Response.json({ data: null, error: "Not enough seats available" }, { status: 409 });
      }
      throw new Error(error.message);
    }

    const { booking_id, amount_paise } = data as { booking_id: string; amount_paise: number };

    if (traveler_name) {
      await adminClient
        .from("Booking")
        .update({ traveler_name, traveler_phone: traveler_phone ?? null })
        .eq("id", booking_id);
    }

    if (payment_method === "razorpay") {
      try {
        const { createOrder } = await import("@/lib/razorpay");
        const order = await createOrder(amount_paise, booking_id);
        await adminClient.from("Payment").insert({
          booking_id,
          razorpay_order_id: order.id,
          amount_paise,
          status: "PENDING",
          method: "razorpay",
        });
        return Response.json({
          data: { booking_id, razorpay_order_id: order.id, amount_paise },
          error: null,
        }, { status: 201 });
      } catch (razorpayErr) {
        console.error("[bookings POST] razorpay failed", razorpayErr);
      }
    }

    return Response.json({
      data: { booking_id, amount_paise, payment_method: "cash" },
      error: null,
    }, { status: 201 });

  } catch (err) {
    console.error("[bookings POST]", err);
    return Response.json({ data: null, error: "Booking failed. Please try again." }, { status: 500 });
  }
}
