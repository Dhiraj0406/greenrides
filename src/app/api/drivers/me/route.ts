// src/app/api/drivers/me/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

async function getAuthedDriver(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  return user ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedDriver(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: profile } = await db
    .from("DriverProfile")
    .select("id, vehicle_type, vehicle_model, vehicle_number, license_number, is_approved, is_online, avg_rating, total_trips, availability, approved_at, telegram_chat_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return Response.json({ data: null, error: null });

  // Fetch active dispatch (PENDING status assigned to this driver)
  const { data: activeDispatch } = await db
    .from("DriverDispatch")
    .select("id, request_id, expires_at, dispatched_at")
    .eq("driver_id", user.id)
    .eq("status", "PENDING")
    .maybeSingle();

  let requestDetails = null;
  if (activeDispatch) {
    const { data: req_ } = await db
      .from("RideRequest")
      .select("id, from_city, to_city, fare_paise, travel_date, notes")
      .eq("id", activeDispatch.request_id)
      .single();
    requestDetails = req_;
  }

  return Response.json({
    data: {
      ...profile,
      active_dispatch: activeDispatch ? { ...activeDispatch, request: requestDetails } : null,
    },
    error: null,
  });
}

const patchSchema = z.object({
  is_online:    z.boolean().optional(),
  availability: z.record(z.string(), z.union([
    z.object({ start: z.string(), end: z.string() }),
    z.literal("rest"),
  ])).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthedDriver(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = getAdminClient();

  // If trying to go online, verify required days (next 7) are all filled
  if (parsed.data.is_online === true) {
    const { data: profile } = await db
      .from("DriverProfile")
      .select("availability, is_approved")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_approved) {
      return Response.json({ error: "Account not approved yet" }, { status: 403 });
    }

    const avail = (profile.availability as Record<string, unknown>) ?? {};
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      if (!avail[key]) {
        return Response.json(
          { error: `Fill availability for all 7 required days before going online (missing: ${key})` },
          { status: 400 }
        );
      }
    }
  }

  const { error } = await db
    .from("DriverProfile")
    .update({ ...parsed.data })
    .eq("user_id", user.id);

  if (error) {
    console.error("[drivers/me PATCH]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json({ data: { ok: true }, error: null });
}
