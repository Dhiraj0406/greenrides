import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("booking"), booking_id: z.string().uuid(), score: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal("request"), request_id: z.string().uuid(), score: z.number().int().min(1).max(5) }),
]);

async function updateDriverRating(driverId: string) {
  const ratings = await prisma.rating.findMany({ where: { rated_id: driverId }, select: { score: true } });
  const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  await prisma.driverProfile.update({ where: { user_id: driverId }, data: { avg_rating: avg } });

  if (avg < 3.5 && ratings.length >= 10) {
    const db = getAdminClient();
    await db.from("DriverProfile").update({ is_online: false }).eq("user_id", driverId);
    const { data: profile } = await db.from("DriverProfile").select("telegram_chat_id").eq("user_id", driverId).maybeSingle();
    if (profile?.telegram_chat_id) {
      const { sendTelegramMessage } = await import("@/lib/telegram");
      await sendTelegramMessage(
        profile.telegram_chat_id,
        `⚠️ Your account has been set offline. Your rating (${avg.toFixed(1)}) has fallen below our minimum standard (3.5). Please contact support to re-activate.`
      );
    }
  }
  return avg;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const adminClient = getAdminClient();
  const { data: userData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !userData.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const userId = userData.user.id;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.type === "booking") {
    const { booking_id, score } = parsed.data;
    const booking = await prisma.booking.findUnique({
      where: { id: booking_id },
      include: { ride: { select: { driver_id: true } } },
    });
    if (!booking) return Response.json({ data: null, error: "Booking not found" }, { status: 400 });
    if (booking.rider_id !== userId) return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
    if (booking.status !== "COMPLETED") return Response.json({ data: null, error: "Booking is not completed" }, { status: 403 });
    const existing = await prisma.rating.findUnique({ where: { booking_id } });
    if (existing) return Response.json({ data: null, error: "Already rated" }, { status: 403 });

    const driverId = booking.ride.driver_id;
    const rating = await prisma.rating.create({ data: { booking_id, rater_id: userId, rated_id: driverId, score } });
    const avg = await updateDriverRating(driverId);
    return Response.json({ data: { rating_id: rating.id, avg_rating: avg }, error: null }, { status: 201 });
  }

  // Request rating
  const { request_id, score } = parsed.data;
  const db = getAdminClient();
  const { data: rideReq } = await db.from("RideRequest").select("rider_id, status").eq("id", request_id).maybeSingle();
  if (!rideReq) return Response.json({ data: null, error: "Request not found" }, { status: 400 });
  if (rideReq.rider_id !== userId) return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
  if (rideReq.status !== "COMPLETED") return Response.json({ data: null, error: "Request is not completed" }, { status: 403 });

  const existing = await prisma.rating.findFirst({ where: { request_id, rater_id: userId } });
  if (existing) return Response.json({ data: null, error: "Already rated" }, { status: 403 });

  const { data: dispatch } = await db.from("DriverDispatch").select("driver_id").eq("request_id", request_id).eq("status", "ACCEPTED").maybeSingle();
  if (!dispatch) return Response.json({ data: null, error: "No accepted driver for this request" }, { status: 400 });

  const driverId = dispatch.driver_id;
  const rating = await prisma.rating.create({ data: { request_id, rater_id: userId, rated_id: driverId, score } });
  const avg = await updateDriverRating(driverId);
  return Response.json({ data: { rating_id: rating.id, avg_rating: avg }, error: null }, { status: 201 });
}
