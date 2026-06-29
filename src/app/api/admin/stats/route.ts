import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db    = getAdminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [todayRes, weekRes, activeRes, pendingRes] = await Promise.all([
    db.from("RideRequest").select("fare_paise").eq("status", "COMPLETED").eq("travel_date", today),
    db.from("RideRequest").select("fare_paise").eq("status", "COMPLETED").gte("travel_date", weekAgo),
    db.from("RideRequest").select("id", { count: "exact", head: true }).in("status", ["CONFIRMED", "IN_PROGRESS"]),
    db.from("RideRequest").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  const today_revenue = (todayRes.data ?? []).reduce((s, r) => s + (r.fare_paise ?? 0), 0);
  const week_revenue  = (weekRes.data  ?? []).reduce((s, r) => s + (r.fare_paise ?? 0), 0);

  return Response.json({
    data: {
      today_revenue,
      week_revenue,
      active_trips:     activeRes.count  ?? 0,
      pending_requests: pendingRes.count ?? 0,
    },
    error: null,
  });
}
