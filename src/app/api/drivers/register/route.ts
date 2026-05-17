// src/app/api/drivers/register/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  vehicle_type:    z.enum(["sedan", "suv", "hatchback", "minivan"]),
  vehicle_model:   z.string().min(2).max(60),
  vehicle_number:  z.string().min(4).max(20).toUpperCase(),
  license_number:  z.string().min(4).max(30).toUpperCase(),
  telegram_code:   z.string().length(6),
});

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { vehicle_type, vehicle_model, vehicle_number, license_number, telegram_code } = parsed.data;
  const now = new Date().toISOString();

  // Validate Telegram code
  const { data: codeRow } = await db
    .from("TelegramCode")
    .select("chat_id, expires_at")
    .eq("code", telegram_code)
    .single();

  if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
    return Response.json({ error: "Invalid or expired Telegram code" }, { status: 400 });
  }

  // Check no existing profile
  const { data: existing } = await db
    .from("DriverProfile")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "Driver profile already exists" }, { status: 409 });
  }

  // Ensure user row exists in User table
  await db.from("User").upsert(
    { id: user.id, phone: user.phone ?? `unknown-${user.id.slice(0, 8)}`, role: "DRIVER", updated_at: now },
    { onConflict: "id" }
  );

  // Create DriverProfile
  const { data: profile, error: createErr } = await db
    .from("DriverProfile")
    .insert({
      id:               crypto.randomUUID(),
      user_id:          user.id,
      vehicle_type,
      vehicle_model,
      vehicle_number,
      license_number,
      telegram_chat_id: codeRow.chat_id,
      is_approved:      false,
      is_online:        false,
      avg_rating:       0,
      total_trips:      0,
      created_at:       now,
    })
    .select("id")
    .single();

  if (createErr || !profile) {
    console.error("[drivers/register POST]", createErr);
    return Response.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // Delete the used code
  await db.from("TelegramCode").delete().eq("code", telegram_code);

  return Response.json({ data: { id: profile.id }, error: null });
}
