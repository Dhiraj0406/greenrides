import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { todayISO } from "@/lib/utils";

const querySchema = z.object({
  from:  z.string().min(2).optional(),
  to:    z.string().min(2).optional(),
  date:  z.string().optional(),
  seats: z.coerce.number().int().min(1).max(6).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse({
    from:  searchParams.get("from")  ?? undefined,
    to:    searchParams.get("to")    ?? undefined,
    date:  searchParams.get("date")  ?? undefined,
    seats: searchParams.get("seats") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { from, to, date, seats } = parsed.data;
  const targetDate = date ?? todayISO();
  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`).toISOString();
  const endOfDay   = new Date(`${targetDate}T23:59:59.999Z`).toISOString();

  try {
    const db = getAdminClient();
    let query = db
      .from("Ride")
      .select(`
        id, from_city, to_city, departure_time, total_seats, available_seats,
        fare_paise, pickup_points, notes, status,
        User!driver_id (id, name, phone, avatar_url,
          DriverProfile (vehicle_type, vehicle_number, vehicle_model, avg_rating, total_trips)
        )
      `)
      .eq("status", "SCHEDULED")
      .gte("departure_time", startOfDay)
      .lte("departure_time", endOfDay)
      .order("departure_time", { ascending: true });

    if (from)  query = query.eq("from_city", from)  as typeof query;
    if (to)    query = query.eq("to_city", to)      as typeof query;
    if (seats) query = query.gte("available_seats", seats) as typeof query;

    const { data: rides, error } = await query;

    if (error) {
      console.error("[rides GET]", error);
      return Response.json({ data: null, error: "Failed to fetch rides" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted = (rides as any[]).map((r) => {
      const driver = r.User ?? {};
      const profile = Array.isArray(driver.DriverProfile)
        ? driver.DriverProfile[0]
        : driver.DriverProfile;
      return {
        id:              r.id,
        from_city:       r.from_city,
        to_city:         r.to_city,
        departure_time:  r.departure_time,
        total_seats:     r.total_seats,
        available_seats: r.available_seats,
        fare_paise:      r.fare_paise,
        fare_rupees:     Math.round(r.fare_paise / 100),
        pickup_points:   r.pickup_points,
        notes:           r.notes,
        status:          r.status,
        driver: {
          id:             driver.id ?? "",
          name:           driver.name ?? "Driver",
          phone:          driver.phone ?? "",
          avatar_url:     driver.avatar_url ?? null,
          vehicle_type:   profile?.vehicle_type   ?? "",
          vehicle_number: profile?.vehicle_number ?? "",
          vehicle_model:  profile?.vehicle_model  ?? "",
          avg_rating:     profile?.avg_rating      ?? 0,
          total_trips:    profile?.total_trips     ?? 0,
        },
      };
    });

    return Response.json({ data: formatted, error: null });
  } catch (err) {
    console.error("[rides GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch rides" },
      { status: 500 }
    );
  }
}

// POST /api/rides — driver posts a new ride
const postSchema = z.object({
  driver_id:      z.string().uuid(),
  from_city:      z.string().min(2),
  to_city:        z.string().min(2),
  departure_time: z.string().datetime(),
  total_seats:    z.number().int().min(1).max(6),
  fare_paise:     z.number().int().min(1000),
  pickup_points:  z.array(z.string()).default([]),
  notes:          z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  if (user.id !== parsed.data.driver_id) {
    return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  try {
    const { data: ride, error } = await db
      .from("Ride")
      .insert({
        id:              crypto.randomUUID(),
        driver_id:       parsed.data.driver_id,
        from_city:       parsed.data.from_city,
        to_city:         parsed.data.to_city,
        departure_time:  new Date(parsed.data.departure_time).toISOString(),
        total_seats:     parsed.data.total_seats,
        available_seats: parsed.data.total_seats,
        fare_paise:      parsed.data.fare_paise,
        pickup_points:   parsed.data.pickup_points,
        notes:           parsed.data.notes ?? null,
        updated_at:      now,
      })
      .select("id")
      .single();

    if (error || !ride) {
      console.error("[rides POST]", error);
      return Response.json({ data: null, error: "Failed to create ride" }, { status: 500 });
    }

    return Response.json({ data: { id: ride.id }, error: null }, { status: 201 });
  } catch (err) {
    console.error("[rides POST]", err);
    return Response.json(
      { data: null, error: "Failed to create ride" },
      { status: 500 }
    );
  }
}
