import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
    from:  searchParams.get("from"),
    to:    searchParams.get("to"),
    date:  searchParams.get("date"),
    seats: searchParams.get("seats"),
  });

  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { from, to, date, seats } = parsed.data;
  const targetDate = date ?? todayISO();
  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
  const endOfDay   = new Date(`${targetDate}T23:59:59.999Z`);

  try {
    const rides = await prisma.ride.findMany({
      where: {
        status:         "SCHEDULED",
        ...(from  ? { from_city: from }          : {}),
        ...(to    ? { to_city: to }              : {}),
        departure_time: { gte: startOfDay, lte: endOfDay },
        ...(seats ? { available_seats: { gte: seats } } : {}),
      },
      include: {
        driver: {
          select: {
            id:         true,
            name:       true,
            phone:      true,
            avatar_url: true,
            driver_profile: {
              select: {
                vehicle_type:   true,
                vehicle_number: true,
                vehicle_model:  true,
                avg_rating:     true,
                total_trips:    true,
              },
            },
          },
        },
      },
      orderBy: { departure_time: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted = (rides as any[]).map((r) => ({
      id:              r.id,
      from_city:       r.from_city,
      to_city:         r.to_city,
      departure_time:  r.departure_time.toISOString(),
      total_seats:     r.total_seats,
      available_seats: r.available_seats,
      fare_paise:      r.fare_paise,
      fare_rupees:     Math.round(r.fare_paise / 100),
      pickup_points:   r.pickup_points,
      notes:           r.notes,
      status:          r.status,
      driver: {
        id:            r.driver.id,
        name:          r.driver.name ?? "Driver",
        phone:         r.driver.phone,
        avatar_url:    r.driver.avatar_url,
        vehicle_type:  r.driver.driver_profile?.vehicle_type  ?? "",
        vehicle_number: r.driver.driver_profile?.vehicle_number ?? "",
        vehicle_model: r.driver.driver_profile?.vehicle_model  ?? "",
        avg_rating:    r.driver.driver_profile?.avg_rating      ?? 0,
        total_trips:   r.driver.driver_profile?.total_trips     ?? 0,
      },
    }));

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

  try {
    const ride = await prisma.ride.create({
      data: {
        ...parsed.data,
        departure_time:  new Date(parsed.data.departure_time),
        available_seats: parsed.data.total_seats,
      },
    });
    return Response.json({ data: { id: ride.id }, error: null }, { status: 201 });
  } catch (err) {
    console.error("[rides POST]", err);
    return Response.json(
      { data: null, error: "Failed to create ride" },
      { status: 500 }
    );
  }
}
