import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const db = getAdminClient();

    const { data: profile, error: fetchErr } = await db
      .from("DriverProfile")
      .select("user_id, vehicle_number")
      .eq("id", id)
      .single();

    if (fetchErr || !profile) return Response.json({ data: null, error: "Driver not found" }, { status: 404 });

    // Unlink any vehicles assigned to this driver profile
    await db.from("Vehicle").update({ driver_id: null }).eq("driver_id", id);

    // Delete the DriverProfile row
    const { error: deleteErr } = await db.from("DriverProfile").delete().eq("id", id);
    if (deleteErr) throw deleteErr;

    // Remove "driver" role from app_metadata
    const { data: authData } = await db.auth.admin.getUserById(profile.user_id);
    if (authData?.user) {
      const existingMeta  = authData.user.app_metadata ?? {};
      const existingRoles = (existingMeta.roles as string[] | undefined) ?? [];
      const newRoles      = existingRoles.filter((r) => r !== "driver");
      await db.auth.admin.updateUserById(profile.user_id, {
        app_metadata: { ...existingMeta, roles: newRoles, fleet_status: newRoles.length > 0 ? "active" : "removed" },
      });
    }

    // Revert User.role to RIDER
    await db.from("User").update({ role: "RIDER" }).eq("id", profile.user_id);

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    "driver_removed",
      entity:    "driver",
      entity_id: id,
      details:   { user_id: profile.user_id, vehicle_number: profile.vehicle_number },
    });

    return Response.json({ data: { removed: true }, error: null });
  } catch (err) {
    console.error("[admin/drivers/:id DELETE]", err);
    return Response.json({ data: null, error: "Remove failed" }, { status: 500 });
  }
}

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

    // When revoking approval, revoke fleet access in auth metadata so the
    // driver cannot log in until re-approved (JWT holds fleet_status until expiry).
    if (!input.is_approved) {
      const { data: authData } = await db.auth.admin.getUserById(updated.user_id);
      if (authData?.user) {
        const existingMeta = authData.user.app_metadata ?? {};
        await db.auth.admin.updateUserById(updated.user_id, {
          app_metadata: { ...existingMeta, fleet_status: "pending" },
        });
      }
    }

    try {
      await db.from("AdminLog").insert({
        admin_id:  "admin",
        action:    `driver_${input.is_approved ? "approved" : "rejected"}`,
        entity:    "driver",
        entity_id: id,
        details:   input,
      });
    } catch (logErr) { console.error("[AdminLog] driver approval log failed:", logErr); }

    return Response.json({ data: updated, error: null });
  } catch (err) {
    console.error("[admin/drivers/:id PATCH]", err);
    return Response.json({ data: null, error: "Driver not found or update failed" }, { status: 404 });
  }
}
