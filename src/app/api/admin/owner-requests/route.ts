import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  try {
    // Fetch pending requests
    const { data: requests, error: reqErr } = await db
      .from("OwnerRequest")
      .select("id, user_id, vehicle_count, reason, created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (reqErr) throw reqErr;
    if (!requests?.length) return Response.json({ data: [], error: null });

    const userIds = requests.map((r) => r.user_id);

    // Fetch user names/phones from User table
    const { data: users } = await db
      .from("User")
      .select("id, name, phone")
      .in("id", userIds);

    // Fetch driver tenure from DriverProfile
    const { data: profiles } = await db
      .from("DriverProfile")
      .select("user_id, created_at")
      .in("user_id", userIds);

    const userMap  = Object.fromEntries((users  ?? []).map((u) => [u.id,      u]));
    const profMap  = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = requests.map((r) => {
      const u    = userMap[r.user_id]  ?? {};
      const prof = profMap[r.user_id]  ?? {};
      const monthsActive = prof.created_at
        ? Math.floor((Date.now() - new Date(prof.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;
      return { ...r, name: u.name ?? null, phone: u.phone ?? null, months_active: monthsActive };
    });

    return Response.json({ data: enriched, error: null });
  } catch (err) {
    console.error("[admin/owner-requests GET]", err);
    return Response.json({ data: null, error: "Failed to fetch requests" }, { status: 500 });
  }
}
