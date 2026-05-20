import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getAdminClient();
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const { data: requests, error: fetchErr } = await db
    .from("RideRequest")
    .select("id, from_city, to_city, fare_paise, travel_date, status, notes, driver_name, driver_phone, eta_min, razorpay_order_id, payment_status, created_at")
    .eq("rider_id", user.id)
    .order("created_at", { ascending: false });

  if (fetchErr) {
    console.error("[requests GET]", fetchErr);
    return Response.json({ data: [], error: null });
  }

  const rows = requests ?? [];
  const ids = rows.map((r: { id: string }) => r.id);
  const ratedIds = ids.length
    ? await prisma.rating.findMany({ where: { request_id: { in: ids }, rater_id: user.id }, select: { request_id: true } })
    : [];
  const ratedSet = new Set(ratedIds.map((r: { request_id: string | null }) => r.request_id));

  const data = rows.map((r: { id: string; [key: string]: unknown }) => ({ ...r, has_rating: ratedSet.has(r.id) }));
  return Response.json({ data, error: null });
}

const createSchema = z.object({
  from_city:      z.string().min(1).max(100),
  to_city:        z.string().min(1).max(100),
  fare_paise:     z.number().int().min(50000),
  travel_date:    z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) => d >= new Date().toISOString().split("T")[0],
      "Travel date must be today or in the future"
    ),
  notes:          z.string().max(300).optional(),
  preferred_time: z.enum(["EARLY_MORNING", "MORNING", "AFTERNOON", "EVENING", "NIGHT"]).optional(),
});

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getAdminClient();
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { from_city, to_city, fare_paise, travel_date, notes, preferred_time } = parsed.data;
  const phone = user.phone ?? "";
  const now = new Date().toISOString();
  const db = getAdminClient();

  try {
    // Ensure rider exists in User table
    await db.from("User").upsert(
      {
        id:         user.id,
        phone:      phone || `unknown-${user.id.slice(0, 8)}`,
        role:       "RIDER",
        updated_at: now,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    // Create the ride request
    const { data: request, error: createErr } = await db
      .from("RideRequest")
      .insert({
        id:          crypto.randomUUID(),
        rider_id:    user.id,
        rider_phone: phone,
        from_city,
        to_city,
        fare_paise,
        travel_date:     new Date(travel_date).toISOString(),
        notes:           notes ?? null,
        preferred_time:  preferred_time ?? null,
        updated_at:      now,
      })
      .select("id, status")
      .single();

    if (createErr || !request) {
      console.error("[requests POST]", createErr);
      return Response.json(
        { data: null, error: "Failed to create request. Please try again." },
        { status: 500 }
      );
    }

    // Fire dispatch queue in background — don't block the response
    buildDispatchQueue(request.id, parsed.data.travel_date, db).catch((e) =>
      console.error("[requests POST] dispatch queue failed", e)
    );

    return Response.json({ data: { id: request.id, status: request.status }, error: null });
  } catch (err) {
    console.error("[requests POST]", err);
    return Response.json(
      { data: null, error: "Failed to create request. Please try again." },
      { status: 500 }
    );
  }
}

async function buildDispatchQueue(
  requestId: string,
  travelDate: string,
  db: SupabaseClient,
): Promise<void> {
  const { data: rideRequest } = await db
    .from("RideRequest")
    .select("from_city, to_city, fare_paise")
    .eq("id", requestId)
    .single();

  if (!rideRequest) return;

  // Get all approved, online drivers
  const { data: profiles } = await db
    .from("DriverProfile")
    .select("id, user_id, avg_rating, total_trips, approved_at, availability, telegram_chat_id")
    .eq("is_approved", true)
    .eq("is_online", true);

  if (!profiles || profiles.length === 0) return;

  // Filter: null/empty availability = available all days; explicit "rest" = unavailable
  const eligible = profiles.filter((p) => {
    const avail = (p.availability as Record<string, unknown> | null) ?? {};
    if (Object.keys(avail).length === 0) return true;
    const day = avail[travelDate];
    return day !== "rest";
  });

  if (eligible.length === 0) return;

  eligible.sort((a, b) => {
    if (b.avg_rating !== a.avg_rating) return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    if (a.total_trips !== b.total_trips) return a.total_trips - b.total_trips;
    return new Date(a.approved_at ?? 0).getTime() - new Date(b.approved_at ?? 0).getTime();
  });

  const now    = new Date();
  const expiry = new Date(now.getTime() + 60_000).toISOString();

  const dispatches = eligible.map((p, i) => ({
    id:            crypto.randomUUID(),
    request_id:    requestId,
    driver_id:     p.user_id,
    order_index:   i + 1,
    status:        i === 0 ? "PENDING" : "WAITING",
    dispatched_at: i === 0 ? now.toISOString() : null,
    expires_at:    i === 0 ? expiry : null,
    created_at:    now.toISOString(),
  }));

  await db.from("DriverDispatch").insert(dispatches);
  await db.from("RideRequest").update({ dispatched: true }).eq("id", requestId);

  // Notify first driver via Telegram
  const firstDriver = eligible[0];
  if (firstDriver.telegram_chat_id) {
    await sendTelegramMessage(
      firstDriver.telegram_chat_id,
      `🚗 <b>New ride request</b>\n\n${rideRequest.from_city} → ${rideRequest.to_city} · ₹${Math.round(rideRequest.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`
    );
  }
}
