import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

const STALE_MS = 4 * 60 * 60 * 1000;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { data: request } = await db
      .from("RideRequest")
      .select("id, status, rider_id")
      .eq("id", id)
      .maybeSingle();

    if (!request || request.rider_id !== user.id) {
      return Response.json({ data: null, error: "Not found" }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return Response.json({ data: null, error: "Only PENDING requests can be cancelled" }, { status: 409 });
    }

    const { error: updateErr } = await db
      .from("RideRequest")
      .update({ status: "CANCELLED" })
      .eq("id", id);

    if (updateErr) throw updateErr;
    return Response.json({ data: { cancelled: true }, error: null });
  } catch (err) {
    console.error("[requests/:id DELETE]", err);
    return Response.json({ data: null, error: "Failed to cancel request" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: request, error } = await db
    .from("RideRequest")
    .select("id, status, from_city, to_city, fare_paise, driver_name, driver_phone, eta_min, trip_otp, travel_date, notes, created_at, rider_phone")
    .eq("id", id)
    .eq("rider_id", user.id)
    .maybeSingle();

  if (error || !request) {
    return Response.json({ data: null, error: "Not found" }, { status: 404 });
  }

  if (request.status === "PENDING" && Date.now() - new Date(request.created_at as string).getTime() > STALE_MS) {
    const now = new Date().toISOString();
    const { data: cancelled } = await db
      .from("RideRequest")
      .update({ status: "CANCELLED", updated_at: now })
      .eq("id", id)
      .eq("status", "PENDING")
      .select("id");

    if (cancelled && cancelled.length > 0) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId) {
        const date = new Date(request.travel_date as string).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
        });
        const booked = new Date(request.created_at as string).toLocaleString("en-IN", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
        });
        sendTelegramMessage(
          adminChatId,
          `❌ <b>No driver found — auto-cancelled</b>\n\nRoute: ${request.from_city} → ${request.to_city}\nDate: ${date}\nRider: ${request.rider_phone}\nBooked: ${booked}`,
        ).catch(() => {});
      }
    }

    return Response.json({ data: { ...request, status: "CANCELLED" }, error: null });
  }

  return Response.json({ data: request, error: null });
}
