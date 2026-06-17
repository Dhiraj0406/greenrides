import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const patchSchema = z.object({ is_approved: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const result = patchSchema.safeParse(body);
  if (!result.success) return Response.json({ data: null, error: result.error.issues[0].message }, { status: 400 });
  const input = result.data;

  try {
    const db = getAdminClient();

    const { data: updated, error } = await db
      .from("DriverProfile")
      .update({
        is_approved: input.is_approved,
        approved_at: input.is_approved ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("*, user:user_id(name), telegram_chat_id")
      .single();

    if (error || !updated) {
      console.error("[admin/drivers/:id PATCH]", error);
      return Response.json({ data: null, error: "Driver not found or update failed" }, { status: 404 });
    }

    if (input.is_approved && updated.telegram_chat_id) {
      const userName = (updated.user as { name?: string } | null)?.name ?? "Driver";
      await sendTelegramMessage(
        updated.telegram_chat_id,
        `✅ <b>You're approved on Green Rides!</b>\n\nWelcome, ${userName}! Open the app to set your schedule and go online.\n\nhttps://green-rides.vercel.app/drivers/dashboard`
      );
    }

    try {
      await db.from("AdminLog").insert({
        admin_id:  "admin",
        action:    `driver_${input.is_approved ? "approved" : "rejected"}`,
        entity:    "driver",
        entity_id: id,
        details:   input,
      });
    } catch {}

    return Response.json({ data: updated, error: null });
  } catch (err) {
    console.error("[admin/drivers/:id PATCH]", err);
    return Response.json({ data: null, error: "Driver not found or update failed" }, { status: 404 });
  }
}
