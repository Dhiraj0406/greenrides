import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  booking_id: z.string().uuid(),
  score: z.number().int().min(1).max(5),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = getAdminClient();
  const { data: userData, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !userData.user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { booking_id, score } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: booking_id },
    include: { ride: { select: { driver_id: true } } },
  });

  if (!booking) {
    return Response.json({ data: null, error: "Booking not found" }, { status: 400 });
  }

  if (booking.rider_id !== userId) {
    return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  if (booking.status !== "COMPLETED") {
    return Response.json({ data: null, error: "Booking is not completed" }, { status: 403 });
  }

  const existing = await prisma.rating.findUnique({ where: { booking_id } });
  if (existing) {
    return Response.json({ data: null, error: "Already rated" }, { status: 403 });
  }

  const driverId = booking.ride.driver_id;

  const rating = await prisma.rating.create({
    data: {
      booking_id,
      rater_id: userId,
      rated_id: driverId,
      score,
    },
  });

  const ratings = await prisma.rating.findMany({
    where: { rated_id: driverId },
    select: { score: true },
  });
  const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  await prisma.driverProfile.update({
    where: { user_id: driverId },
    data: { avg_rating: avg, total_trips: { increment: 1 } },
  });

  return Response.json({ data: { rating_id: rating.id, avg_rating: avg }, error: null }, { status: 201 });
}
