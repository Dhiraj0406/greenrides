import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch active dispatches (PENDING = awaiting response, ACCEPTED = confirmed trip)
  const { data: dispatches, error: fetchErr } = await db
    .from("DriverDispatch")
    .select("id, status, expires_at, request_id, created_at")
    .eq("driver_id", user.id)
    .in("status", ["PENDING", "ACCEPTED"])
    .order("created_at", { ascending: false });

  if (fetchErr) {
    console.error("[fleet/dispatches GET]", fetchErr);
    return Response.json({ data: [], error: null });
  }

  if (!dispatches || dispatches.length === 0) {
    return Response.json({ data: [], error: null });
  }

  // Batch-fetch the linked ride requests
  const requestIds = dispatches.map((d: { request_id: string }) => d.request_id);
  const { data: requests } = await db
    .from("RideRequest")
    .select("id, from_city, to_city, fare_paise, travel_date, status, rider_phone, trip_otp, notes")
    .in("id", requestIds);

  const reqMap = new Map((requests ?? []).map((r: { id: string; [key: string]: unknown }) => [r.id, r]));

  const data = dispatches.map((d: { request_id: string; status: string; [key: string]: unknown }) => {
    const req = reqMap.get(d.request_id) as Record<string, unknown> | undefined;
    return {
      ...d,
      request: req
        ? {
            ...req,
            // Only expose trip_otp to the driver when they need to verify it at pickup
            trip_otp: (req.status === "CONFIRMED" || req.status === "IN_PROGRESS") ? req.trip_otp : null,
          }
        : null,
    };
  });

  return Response.json({ data, error: null });
}
