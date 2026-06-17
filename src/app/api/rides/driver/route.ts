import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token || "");
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const all  = req.nextUrl.searchParams.get("all") === "true";
  const date = req.nextUrl.searchParams.get("date");

  try {
    let query = db
      .from("Ride")
      .select("*, Booking(id, seats, pickup_point, amount_paise, status, traveler_name, traveler_phone, rider:rider_id(name, phone))")
      .eq("driver_id", user.id)
      .order("departure_time", { ascending: false })
      .limit(all ? 100 : 10);

    if (!all && date) {
      const start = new Date(`${date}T00:00:00+05:30`).toISOString();
      const end   = new Date(`${date}T23:59:59.999+05:30`).toISOString();
      query = query.gte("departure_time", start).lte("departure_time", end) as typeof query;
    }

    const { data: rides, error } = await query;
    if (error) throw error;

    const formatted = (rides ?? []).map((r) => ({
      ...r,
      bookings: ((r as Record<string, unknown>).Booking as Array<{ status: string }> ?? [])
        .filter((b) => ["CONFIRMED", "COMPLETED"].includes(b.status)),
    }));

    return Response.json({ data: formatted, error: null });
  } catch (err) {
    console.error("[rides/driver GET]", err);
    return Response.json({ data: null, error: "Failed to fetch rides" }, { status: 500 });
  }
}
