// src/app/api/requests/[id]/respond/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { getFlag } from "@/modules/platform/db";

const schema = z.object({
  action:      z.enum(["accept", "reject"]),
  dispatch_id: z.string().uuid(),
  eta_min:     z.number().int().min(1).max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { action, dispatch_id, eta_min } = parsed.data;
  const now = new Date().toISOString();

  // Verify this dispatch belongs to the authed driver and is currently PENDING
  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id, request_id, driver_id, status")
    .eq("id", dispatch_id)
    .eq("driver_id", user.id)
    .eq("request_id", requestId)
    .single();

  if (!dispatch || dispatch.status !== "PENDING") {
    return Response.json({ error: "Dispatch not found or already resolved" }, { status: 404 });
  }

  if (action === "accept") {
    // Mark this dispatch ACCEPTED
    await db.from("DriverDispatch").update({ status: "ACCEPTED", responded_at: now }).eq("id", dispatch_id);

    // Mark other in-flight dispatches as SKIPPED (preserve REJECTED/EXPIRED history)
    await db
      .from("DriverDispatch")
      .update({ status: "SKIPPED" })
      .eq("request_id", requestId)
      .neq("id", dispatch_id)
      .in("status", ["PENDING", "WAITING"]);

    // Get driver profile for telegram
    const { data: driverProfile } = await db
      .from("DriverProfile")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .single();

    const { data: userRow } = await db
      .from("User")
      .select("name, phone")
      .eq("id", user.id)
      .single();

    // Generate a 6-digit trip OTP the rider shows to the driver at pickup
    const tripOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update the RideRequest with driver info and trip OTP
    await db
      .from("RideRequest")
      .update({
        status:       "CONFIRMED",
        driver_name:  userRow?.name ?? "Driver",
        driver_phone: userRow?.phone ?? "",
        eta_min:      eta_min ?? null,
        trip_otp:     tripOtp,
        updated_at:   now,
      })
      .eq("id", requestId);

    const { data: rideReqData } = await db
      .from("RideRequest")
      .select("fare_paise")
      .eq("id", requestId)
      .single();

    const razorpayEnabled = await getFlag("payments.razorpay_enabled", false);
    if (razorpayEnabled && rideReqData) {
      try {
        const { createOrder } = await import("@/lib/razorpay");
        const order = await createOrder(rideReqData.fare_paise, requestId);
        await db
          .from("RideRequest")
          .update({ razorpay_order_id: order.id, payment_status: "PENDING", updated_at: now })
          .eq("id", requestId);
      } catch (orderErr) {
        console.error("[respond/accept] Razorpay order failed", orderErr);
      }
    }

    // Notify the rider via Telegram
    const { data: rideRequest } = await db
      .from("RideRequest")
      .select("rider_id, from_city, to_city")
      .eq("id", requestId)
      .single();

    if (rideRequest) {
      const { data: riderProfile } = await db
        .from("DriverProfile")
        .select("telegram_chat_id")
        .eq("user_id", rideRequest.rider_id)
        .maybeSingle();

      if (riderProfile?.telegram_chat_id) {
        await sendTelegramMessage(
          riderProfile.telegram_chat_id,
          `✅ <b>Driver found!</b>\n\n${userRow?.name ?? "Driver"} · ${userRow?.phone ?? ""}\nETA: ${eta_min ? `${eta_min} mins` : "Will contact you"}\n\nRoute: ${rideRequest.from_city} → ${rideRequest.to_city}`
        );
      }
    }

    return Response.json({ data: { ok: true, action: "accepted" }, error: null });
  }

  // Reject: mark REJECTED (guard: only if still PENDING — prevents cron double-fire race)
  await db.from("DriverDispatch").update({ status: "REJECTED", responded_at: now }).eq("id", dispatch_id).eq("status", "PENDING");

  const { data: nextDispatch } = await db
    .from("DriverDispatch")
    .select("id, driver_id")
    .eq("request_id", requestId)
    .eq("status", "WAITING")
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextDispatch) {
    const nextExpiry = new Date(Date.now() + 60_000).toISOString();
    await db
      .from("DriverDispatch")
      .update({ status: "PENDING", dispatched_at: now, expires_at: nextExpiry })
      .eq("id", nextDispatch.id)
      .eq("status", "WAITING");

    // Notify next driver (gated by dispatch.telegram_cascade flag)
    const telegramCascade = await getFlag("dispatch.telegram_cascade", true);
    const { data: nextProfile } = await db
      .from("DriverProfile")
      .select("telegram_chat_id")
      .eq("user_id", nextDispatch.driver_id)
      .single();

    const { data: request } = await db
      .from("RideRequest")
      .select("from_city, to_city, fare_paise")
      .eq("id", requestId)
      .single();

    if (telegramCascade && nextProfile?.telegram_chat_id && request) {
      await sendTelegramMessage(
        nextProfile.telegram_chat_id,
        `🚗 <b>New ride request</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`
      );
    }
  } else {
    // No more drivers — cancel the request
    await db.from("RideRequest").update({ status: "CANCELLED", updated_at: now }).eq("id", requestId);

    const { data: rideRequest } = await db
      .from("RideRequest")
      .select("rider_id")
      .eq("id", requestId)
      .single();

    if (rideRequest) {
      const { data: riderProfile } = await db
        .from("DriverProfile")
        .select("telegram_chat_id")
        .eq("user_id", rideRequest.rider_id)
        .maybeSingle();
      if (riderProfile?.telegram_chat_id) {
        await sendTelegramMessage(
          riderProfile.telegram_chat_id,
          `😔 No drivers available right now. We'll notify you when one is free.`
        );
      }
    }
  }

  return Response.json({ data: { ok: true, action: "rejected" }, error: null });
}
