import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isInternal   = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isInternal) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const db      = getAdminClient();
  const cutoff  = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const now     = new Date().toISOString();

  const { data: stale, error } = await db
    .from("RideRequest")
    .select("id, from_city, to_city, travel_date, rider_phone, created_at")
    .eq("status", "PENDING")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[auto-cancel]", error);
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return Response.json({ data: { cancelled: 0 }, error: null });
  }

  const ids = stale.map((r) => r.id);

  const { error: updateErr } = await db
    .from("RideRequest")
    .update({ status: "CANCELLED", updated_at: now })
    .in("id", ids);

  if (updateErr) {
    console.error("[auto-cancel] update failed", updateErr);
    return Response.json({ data: null, error: updateErr.message }, { status: 500 });
  }

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    await Promise.allSettled(
      stale.map((r) => {
        const date = new Date(r.travel_date).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
        });
        const booked = new Date(r.created_at).toLocaleString("en-IN", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
        });
        return sendTelegramMessage(
          adminChatId,
          `❌ <b>No driver found — auto-cancelled</b>\n\nRoute: ${r.from_city} → ${r.to_city}\nDate: ${date}\nRider: ${r.rider_phone}\nBooked: ${booked}`,
        );
      }),
    );
  }

  console.log(`[auto-cancel] Cancelled ${ids.length} stale request(s):`, ids);
  return Response.json({ data: { cancelled: ids.length }, error: null });
}
