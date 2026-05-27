import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const ride = await prisma.ride.findUnique({
      where: { id },
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
        bookings: { select: { id: true, status: true, seats: true } },
      },
    });

    if (!ride) {
      return Response.json(
        { data: null, error: "Ride not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: ride, error: null });
  } catch (err) {
    console.error("[rides/[id] GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch ride" },
      { status: 500 }
    );
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

  const ride = await prisma.ride.findUnique({
    where: { id },
    select: { driver_id: true, status: true },
  });

  if (!ride) return Response.json({ data: null, error: "Ride not found" }, { status: 404 });
  if (ride.driver_id !== user.id) return Response.json({ data: null, error: "Forbidden" }, { status: 403 });

  const validTransitions: Record<string, string> = {
    IN_PROGRESS: "SCHEDULED",
    COMPLETED: "IN_PROGRESS",
  };

  if (ride.status !== validTransitions[newStatus]) {
    return Response.json({ data: null, error: `Cannot transition from ${ride.status} to ${newStatus}` }, { status: 409 });
  }

  try {
    await prisma.ride.update({ where: { id }, data: { status: newStatus as never } });

    if (newStatus === "COMPLETED") {
      await prisma.booking.updateMany({
        where: { ride_id: id, status: "CONFIRMED" },
        data: { status: "COMPLETED" },
      });

      await prisma.driverProfile.update({
        where: { user_id: user.id },
        data: { total_trips: { increment: 1 } },
      });
    }

    return Response.json({ data: { status: newStatus }, error: null });
  } catch (err) {
    console.error("[rides/[id] PATCH]", err);
    return Response.json({ data: null, error: "Failed to update ride" }, { status: 500 });
  }
}
