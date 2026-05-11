import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/razorpay";
import { getAdminClient } from "@/lib/supabase";

// ─── GET /api/bookings ───────────────────────────────────────────────────────
// ?admin=1 + x-admin-token header → all bookings (admin panel)
// Authorization: Bearer <token>   → rider's own bookings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isAdmin = searchParams.get("admin") === "1";

  // ── Admin path ────────────────────────────────────────────────────────────
  if (isAdmin) {
    const token = req.headers.get("x-admin-token") ?? "";
    if (token !== process.env.NEXT_PUBLIC_ADMIN_TOKEN) {
      return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    try {
      const bookings = await prisma.booking.findMany({
        orderBy: { created_at: "desc" },
        take: 100,
        include: {
          ride:  { select: { from_city: true, to_city: true } },
          rider: { select: { name: true, phone: true } },
        },
      });
      return Response.json({ data: bookings, error: null });
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

  // Verify token via Supabase admin client (bypasses RLS, just validates JWT)
  const adminClient = getAdminClient();
  const { data: userData, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !userData.user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  try {
    const bookings = await prisma.booking.findMany({
      where:   { rider_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        ride: {
          include: {
            driver: {
              select: {
                name: true,
                driver_profile: { select: { vehicle_number: true, vehicle_model: true } },
              },
            },
          },
        },
        rating: { select: { id: true } },
      },
    });

    const data = bookings.map((b) => ({
      id:             b.id,
      status:         b.status,
      amount_paise:   b.amount_paise,
      pickup_point:   b.pickup_point,
      seats:          b.seats,
      created_at:     b.created_at.toISOString(),
      from:           b.ride.from_city,
      to:             b.ride.to_city,
      departure_time: b.ride.departure_time.toISOString(),
      driver_name:    b.ride.driver.name ?? "Driver",
      vehicle_number: b.ride.driver.driver_profile?.vehicle_number ?? "",
      vehicle_model:  b.ride.driver.driver_profile?.vehicle_model ?? "",
      has_rating:     !!b.rating,
    }));

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[bookings GET rider]", err);
    return Response.json({ data: null, error: "Failed to fetch bookings" }, { status: 500 });
  }
}

// ─── POST /api/bookings ──────────────────────────────────────────────────────

const schema = z.object({
  ride_id:     z.string().uuid(),
  rider_id:    z.string().uuid(),
  seats:       z.number().int().min(1).max(6),
  pickup_point: z.string().min(2),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { data: null, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { ride_id, rider_id, seats, pickup_point } = parsed.data;

  try {
    // Atomic seat booking via Supabase RPC
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
        return Response.json(
          { data: null, error: "Not enough seats available" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    const { booking_id, amount_paise } = data as {
      booking_id: string;
      amount_paise: number;
    };

    // Create Razorpay order
    const order = await createOrder(amount_paise, booking_id);

    // Store order ID in Payment table
    await prisma.payment.create({
      data: {
        booking_id:       booking_id,
        razorpay_order_id: order.id,
        amount_paise,
        status:           "PENDING",
      },
    });

    return Response.json({
      data: {
        booking_id,
        razorpay_order_id: order.id,
        amount_paise,
      },
      error: null,
    }, { status: 201 });

  } catch (err) {
    console.error("[bookings POST]", err);
    return Response.json(
      { data: null, error: "Booking failed. Please try again." },
      { status: 500 }
    );
  }
}
