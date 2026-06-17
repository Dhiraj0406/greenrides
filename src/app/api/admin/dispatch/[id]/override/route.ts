import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const schema = z.union([
  z.object({ action: z.literal("skip") }),
  z.object({ action: z.literal("assign"), driver_id: z.string().uuid() }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const db  = getAdminClient();
  const now = new Date().toISOString();

  if (parsed.data.action === "skip") {
    const { data: dispatch } = await db
      .from("DriverDispatch")
      .select("request_id, order_index")
      .eq("id", id)
      .single();

    if (!dispatch) return Response.json({ error: "Not found" }, { status: 404 });

    await db.from("DriverDispatch").update({ status: "SKIPPED" }).eq("id", id).eq("status", "PENDING");

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
      await db.from("DriverDispatch").update({ status: "PENDING", dispatched_at: now, expires_at: expiry }).eq("id", next.id).eq("status", "WAITING");

      const { data: profile } = await db.from("DriverProfile").select("telegram_chat_id").eq("user_id", next.driver_id).single();
      const { data: request } = await db.from("RideRequest").select("from_city, to_city, fare_paise").eq("id", dispatch.request_id).single();
      if (profile?.telegram_chat_id && request) {
        await sendTelegramMessage(profile.telegram_chat_id, `🚗 <b>New ride request</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`);
      }
    }
    try {
      await db.from("AdminLog").insert({
        admin_id: "admin", action: "dispatch_skipped", entity: "dispatch", entity_id: id,
        details: { request_id: dispatch.request_id },
      });
    } catch {}

    return Response.json({ data: { ok: true }, error: null });
  }

  // Manual assign
  const { data: dispatch } = await db.from("DriverDispatch").select("request_id").eq("id", id).maybeSingle();
  if (!dispatch) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    await db.from("DriverDispatch").update({ status: "SKIPPED" }).eq("request_id", dispatch.request_id).in("status", ["PENDING", "WAITING"]);

    const expiry = new Date(Date.now() + 60_000).toISOString();
    await db.from("DriverDispatch").insert({
      id: crypto.randomUUID(), request_id: dispatch.request_id,
      driver_id: parsed.data.driver_id, order_index: 999,
      status: "PENDING", dispatched_at: now, expires_at: expiry, created_at: now,
    });

    const { data: profile } = await db.from("DriverProfile").select("telegram_chat_id").eq("user_id", parsed.data.driver_id).maybeSingle();
    const { data: request } = await db.from("RideRequest").select("from_city, to_city, fare_paise").eq("id", dispatch.request_id).maybeSingle();
    if (profile?.telegram_chat_id && request) {
      await sendTelegramMessage(profile.telegram_chat_id, `🚗 <b>Admin assigned ride</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond.`);
    }

    try {
      await db.from("AdminLog").insert({
        admin_id: "admin", action: "dispatch_assigned", entity: "dispatch", entity_id: id,
        details: { driver_id: parsed.data.driver_id, request_id: dispatch.request_id },
      });
    } catch {}

    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    console.error("[dispatch/override assign]", err);
    return Response.json({ error: "Failed to assign driver" }, { status: 500 });
  }
}
