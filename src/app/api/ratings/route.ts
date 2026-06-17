import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("booking"), booking_id: z.string().uuid(), score: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal("request"), request_id: z.string().uuid(), score: z.number().int().min(1).max(5) }),
]);

async function updateDriverRating(driverId: string, db: ReturnType<typeof getAdminClient>) {
  const { data: ratings } = await db
    .from("Rating")
    .select("score")
    .eq("rated_id", driverId);

  const list = ratings ?? [];
  if (list.length === 0) return 0;

  const avg = list.reduce((sum: number, r: { score: number }) => sum + r.score, 0) / list.length;
  await db.from("DriverProfile").update({ avg_rating: avg }).eq("user_id", driverId);

  if (avg < 3.5 && list.length >= 10) {
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

  const db = getAdminClient();
  const { data: userData, error: authError } = await db.auth.getUser(token);
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

    const { data: booking } = await db
      .from("Booking")
      .select("id, rider_id, status, ride_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) return Response.json({ data: null, error: "Booking not found" }, { status: 400 });
    if (booking.rider_id !== userId) return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
    if (booking.status !== "COMPLETED") return Response.json({ data: null, error: "Booking is not completed" }, { status: 403 });

    const { data: existing } = await db
      .from("Rating")
      .select("id")
      .eq("booking_id", booking_id)
      .maybeSingle();

    if (existing) return Response.json({ data: null, error: "Already rated" }, { status: 403 });

    const { data: ride } = await db.from("Ride").select("driver_id").eq("id", booking.ride_id).maybeSingle();
    if (!ride) return Response.json({ data: null, error: "Ride not found" }, { status: 400 });

    const driverId = ride.driver_id;
    const { data: rating, error: ratingErr } = await db
      .from("Rating")
      .insert({ booking_id, rater_id: userId, rated_id: driverId, score })
      .select("id")
      .single();

    if (ratingErr || !rating) {
      return Response.json({ data: null, error: "Failed to submit rating" }, { status: 500 });
    }

    const avg = await updateDriverRating(driverId, db);
    return Response.json({ data: { rating_id: rating.id, avg_rating: avg }, error: null }, { status: 201 });
  }

  // Request rating
  const { request_id, score } = parsed.data;

  const { data: rideReq } = await db
    .from("RideRequest")
    .select("rider_id, status")
    .eq("id", request_id)
    .maybeSingle();

  if (!rideReq) return Response.json({ data: null, error: "Request not found" }, { status: 400 });
  if (rideReq.rider_id !== userId) return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
  if (rideReq.status !== "COMPLETED") return Response.json({ data: null, error: "Request is not completed" }, { status: 403 });

  const { data: existingReq } = await db
    .from("Rating")
    .select("id")
    .eq("request_id", request_id)
    .eq("rater_id", userId)
    .maybeSingle();

  if (existingReq) return Response.json({ data: null, error: "Already rated" }, { status: 403 });

  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("driver_id")
    .eq("request_id", request_id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) return Response.json({ data: null, error: "No accepted driver for this request" }, { status: 400 });

  const driverId = dispatch.driver_id;
  const { data: rating, error: ratingErr } = await db
    .from("Rating")
    .insert({ request_id, rater_id: userId, rated_id: driverId, score })
    .select("id")
    .single();

  if (ratingErr || !rating) {
    return Response.json({ data: null, error: "Failed to submit rating" }, { status: 500 });
  }

  const avg = await updateDriverRating(driverId, db);
  return Response.json({ data: { rating_id: rating.id, avg_rating: avg }, error: null }, { status: 201 });
}
