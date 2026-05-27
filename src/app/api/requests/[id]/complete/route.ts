import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;

  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", requestId)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) {
    return Response.json({ error: "Not authorized or request not in accepted state" }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { error } = await db
    .from("RideRequest")
    .update({ status: "COMPLETED", completed_at: now, updated_at: now })
    .eq("id", requestId)
    .eq("status", "IN_PROGRESS");

  if (error) {
    console.error("[requests/complete]", error);
    return Response.json({ error: "Failed to complete request" }, { status: 500 });
  }

  // Clean up location row — no stale pin for completed trips
  await db.from("DriverLocation").delete().eq("request_id", requestId);

  const { data: profile } = await db
    .from("DriverProfile")
    .select("total_trips")
    .eq("user_id", user.id)
    .single();

  if (profile) {
    await db
      .from("DriverProfile")
      .update({ total_trips: (profile.total_trips ?? 0) + 1 })
      .eq("user_id", user.id);
  }

  return Response.json({ data: { completed: true }, error: null });
}
