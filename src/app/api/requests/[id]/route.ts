import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { data: request } = await db
      .from("RideRequest")
      .select("id, status, rider_id")
      .eq("id", id)
      .maybeSingle();

    if (!request || request.rider_id !== user.id) {
      return Response.json({ data: null, error: "Not found" }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return Response.json({ data: null, error: "Only PENDING requests can be cancelled" }, { status: 409 });
    }

    const { error: updateErr } = await db
      .from("RideRequest")
      .update({ status: "CANCELLED" })
      .eq("id", id);

    if (updateErr) throw updateErr;
    return Response.json({ data: { cancelled: true }, error: null });
  } catch (err) {
    console.error("[requests/:id DELETE]", err);
    return Response.json({ data: null, error: "Failed to cancel request" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: request, error } = await db
    .from("RideRequest")
    .select("id, status, from_city, to_city, fare_paise, driver_name, driver_phone, eta_min, trip_otp, travel_date, notes")
    .eq("id", id)
    .eq("rider_id", user.id)
    .maybeSingle();

  if (error || !request) {
    return Response.json({ data: null, error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: request, error: null });
}
