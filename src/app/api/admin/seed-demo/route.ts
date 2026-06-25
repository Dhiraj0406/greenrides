import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

/**
 * POST /api/admin/seed-demo
 * Header: x-admin-token: <ADMIN_SECRET>
 * Body: { "phone": "9876543210" }
 *
 * Creates (or updates) a DriverProfile for the given phone number,
 * setting is_approved=true and is_online=true so the user immediately
 * receives ride dispatches.
 *
 * The phone owner must have logged in at least once (GET /api/users/me
 * is called automatically after OTP verify) for their User row to exist.
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  let body: { phone?: string } = {};
  try { body = await req.json(); } catch { /* optional */ }

  if (!body.phone) {
    return Response.json({
      error: "Pass { \"phone\": \"9876543210\" } (10-digit, no +91). The number must have logged in to the user app first.",
    }, { status: 400 });
  }

  const digits = body.phone.replace(/\D/g, "");
  const phone10 = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;

  if (phone10.length !== 10) {
    return Response.json({ data: null, error: "Provide exactly 10 digits (Indian mobile)" }, { status: 400 });
  }

  const db = getAdminClient();

  // Find the User by their stored phone (normalised to 10 digits in users/me)
  const { data: userRow, error: userErr } = await db
    .from("User")
    .select("id, phone, role")
    .eq("phone", phone10)
    .maybeSingle();

  if (userErr) return Response.json({ data: null, error: userErr.message }, { status: 500 });

  if (!userRow) {
    return Response.json({
      error: `No user found with phone ${phone10}. Ask them to log in to greenrides.co.in first — OTP login creates their account automatically.`,
    }, { status: 404 });
  }

  const userId = userRow.id;
  const now = new Date().toISOString();

  // Upsert DriverProfile
  const { data: existing } = await db
    .from("DriverProfile")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let profile;
  if (existing) {
    const { data, error } = await db
      .from("DriverProfile")
      .update({ is_approved: true, is_online: true, kyc_status: "APPROVED", updated_at: now })
      .eq("user_id", userId)
      .select("id, user_id, is_approved, is_online, kyc_status")
      .single();
    if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
    profile = data;
  } else {
    const { data, error } = await db
      .from("DriverProfile")
      .insert({
        id:            crypto.randomUUID(),
        user_id:       userId,
        is_approved:   true,
        is_online:     true,
        kyc_status:    "APPROVED",
        avg_rating:    5.0,
        total_trips:   0,
        availability:  {},
        vehicle_model: "Swift Dzire",
        vehicle_number: "OD39B1234",
        created_at:    now,
        updated_at:    now,
      })
      .select("id, user_id, is_approved, is_online, kyc_status")
      .single();
    if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
    profile = data;
  }

  // Upgrade User role to DRIVER
  await db.from("User").update({ role: "DRIVER", updated_at: now }).eq("id", userId);

  // Grant fleet portal access via auth metadata so the driver can log in at fleet.greenrides.co.in
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  if (authUser?.user) {
    const existingMeta  = authUser.user.app_metadata ?? {};
    const existingRoles = (existingMeta.roles as string[] | undefined) ?? [];
    if (!existingRoles.includes("driver")) existingRoles.push("driver");
    await db.auth.admin.updateUserById(userId, {
      app_metadata: { ...existingMeta, roles: existingRoles, fleet_status: "active" },
    });
  }

  return Response.json({
    data: { profile, phone: phone10 },
    error: null,
    message: `Demo driver ready. ${phone10} can now log in at fleet.greenrides.co.in and will receive ride dispatches automatically.`,
  });
}
