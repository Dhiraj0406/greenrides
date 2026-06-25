import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { requestId } = await params;

  // Verify caller is the rider on this request
  const { data: rideRequest } = await db
    .from("RideRequest")
    .select("id")
    .eq("id", requestId)
    .eq("rider_id", user.id)
    .maybeSingle();

  if (!rideRequest) {
    return Response.json({ data: null, error: "Not found" }, { status: 404 });
  }

  const { data: location } = await db
    .from("DriverLocation")
    .select("lat, lng, heading, updated_at")
    .eq("request_id", requestId)
    .maybeSingle();

  return Response.json({ data: location ?? null, error: null });
}
