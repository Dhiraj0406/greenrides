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
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { vehicle_type, vehicle_model, vehicle_number, license_number, telegram_code } = parsed.data;
  const now = new Date().toISOString();

  // Atomically consume the Telegram code: delete returns the row only if it exists and is unexpired.
  // Two concurrent requests racing to delete the same code → only one wins; loser gets empty array.
  const { data: consumed } = await db
    .from("TelegramCode")
    .delete()
    .eq("code", telegram_code)
    .gte("expires_at", now)
    .select("chat_id");

  if (!consumed || consumed.length === 0) {
    return Response.json({ data: null, error: "Invalid or expired Telegram code" }, { status: 400 });
  }

  const chatId = consumed[0].chat_id;

  // Check no existing profile
  const { data: existing } = await db
    .from("DriverProfile")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return Response.json({ data: null, error: "Driver profile already exists" }, { status: 409 });
  }

  // Ensure user row exists in User table
  await db.from("User").upsert(
    { id: user.id, phone: user.phone ?? `unknown-${user.id.slice(0, 8)}`, role: "DRIVER", updated_at: now },
    { onConflict: "id" }
  );

  // Create DriverProfile — user_id has a unique constraint so a concurrent insert returns an error code
  const { data: profile, error: createErr } = await db
    .from("DriverProfile")
    .insert({
      user_id:          user.id,
      vehicle_type,
      vehicle_model,
      vehicle_number,
      license_number,
      telegram_chat_id: chatId,
      is_approved:      false,
      is_online:        false,
      avg_rating:       0,
      total_trips:      0,
      created_at:       now,
    })
    .select("id")
    .single();

  if (createErr) {
    if (createErr.code === "23505") {
      return Response.json({ data: null, error: "Driver profile already exists" }, { status: 409 });
    }
    console.error("[drivers/register POST]", createErr);
    return Response.json({ data: null, error: "Failed to create profile" }, { status: 500 });
  }

  return Response.json({ data: { id: profile!.id }, error: null });
}
