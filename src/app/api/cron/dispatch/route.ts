import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Protect: Vercel sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminClient();
  const now = new Date().toISOString();

  // 1. Clean up expired TelegramCodes
  await db.from("TelegramCode").delete().lt("expires_at", now);

  // 2. Find PENDING dispatches that have expired
  const { data: expired } = await db
    .from("DriverDispatch")
    .select("id, request_id, order_index")
    .eq("status", "PENDING")
    .lt("expires_at", now);

  if (!expired || expired.length === 0) {
    return Response.json({ ok: true, cascaded: 0 });
  }

  let cascaded = 0;

  for (const dispatch of expired) {
    // Mark as EXPIRED
    await db.from("DriverDispatch").update({ status: "EXPIRED" }).eq("id", dispatch.id);

    // Find the next WAITING driver for this request
    const { data: next } = await db
      .from("DriverDispatch")
      .select("id, driver_id")
      .eq("request_id", dispatch.request_id)
      .eq("status", "WAITING")
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      const expiry = new Date(Date.now() + 60_000).toISOString();
      await db
        .from("DriverDispatch")
        .update({ status: "PENDING", dispatched_at: now, expires_at: expiry })
        .eq("id", next.id);

      // Get the driver's Telegram chat ID and notify
      const { data: profile } = await db
        .from("DriverProfile")
        .select("telegram_chat_id")
        .eq("user_id", next.driver_id)
        .single();

      const { data: request } = await db
        .from("RideRequest")
        .select("from_city, to_city, fare_paise")
        .eq("id", dispatch.request_id)
        .single();

      if (profile?.telegram_chat_id && request) {
        await sendTelegramMessage(
          profile.telegram_chat_id,
          `🚗 <b>New ride request</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`
        );
      }

      cascaded++;
    } else {
      // No more drivers — cancel the request
      await db
        .from("RideRequest")
        .update({ status: "CANCELLED", updated_at: now })
        .eq("id", dispatch.request_id);

      // Notify rider
      const { data: request } = await db
        .from("RideRequest")
        .select("rider_id")
        .eq("id", dispatch.request_id)
        .single();

      if (request) {
        const { data: riderProfile } = await db
          .from("DriverProfile")
          .select("telegram_chat_id")
          .eq("user_id", request.rider_id)
          .maybeSingle();
        if (riderProfile?.telegram_chat_id) {
          await sendTelegramMessage(
            riderProfile.telegram_chat_id,
            `😔 No drivers available for your request right now. We'll try again when a driver comes online.`
          );
        }
      }
    }
  }

  return Response.json({ ok: true, cascaded });
}
