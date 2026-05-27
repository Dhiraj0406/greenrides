import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

const schema = z.object({ eta_min: z.number().int().min(1).max(300) });

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

  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", requestId)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) return Response.json({ error: "Not authorized" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const now = new Date().toISOString();
  await db.from("RideRequest").update({ eta_min: parsed.data.eta_min, updated_at: now }).eq("id", requestId);

  const { data: request } = await db
    .from("RideRequest")
    .select("rider_id, from_city, to_city")
    .eq("id", requestId)
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
        `🕐 <b>ETA updated</b>\n\nYour driver is ~${parsed.data.eta_min} minutes away.\n\nRoute: ${request.from_city} → ${request.to_city}`
      );
    }
  }

  return Response.json({ data: { ok: true, eta_min: parsed.data.eta_min }, error: null });
}
