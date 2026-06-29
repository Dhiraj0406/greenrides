import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", id)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) return Response.json({ data: null, error: "Not authorized" }, { status: 403 });

  await db.from("RideRequest")
    .update({ eta_min: 0, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "CONFIRMED");

  const { data: request } = await db
    .from("RideRequest")
    .select("rider_id, from_city, to_city")
    .eq("id", id)
    .maybeSingle();

  if (request) {
    const { data: riderProfile } = await db
      .from("DriverProfile")
      .select("telegram_chat_id")
      .eq("user_id", request.rider_id)
      .maybeSingle();

    if (riderProfile?.telegram_chat_id) {
      await sendTelegramMessage(
        riderProfile.telegram_chat_id,
        `📍 <b>Driver has arrived!</b>\n\nYour driver is at the pickup point for your ${request.from_city} → ${request.to_city} trip.\n\nShare your OTP to start the trip.`
      );
    }
  }

  return Response.json({ data: { ok: true }, error: null });
}
