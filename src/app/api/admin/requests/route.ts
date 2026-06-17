import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const VALID_STATUSES = new Set(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const rawStatus = req.nextUrl.searchParams.get("status");
  const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : null;

  try {
    const db = getAdminClient();
    let query = db
      .from("RideRequest")
      .select("*, rider:rider_id(name, phone)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/requests GET]", err);
    return Response.json({ data: null, error: "Failed to fetch requests" }, { status: 500 });
  }
}
