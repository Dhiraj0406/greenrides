import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// Public endpoint — no auth required. Returns sanitised trip data for share links.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getAdminClient();

  const { data } = await db
    .from("RideRequest")
    .select("id, from_city, to_city, travel_date, status, driver_name, eta_min")
    .eq("id", id)
    .in("status", ["CONFIRMED", "IN_PROGRESS", "COMPLETED"])
    .maybeSingle();

  if (!data) return Response.json({ data: null, error: "Trip not found" }, { status: 404 });

  // Only expose first name — never phone/OTP/personal info
  const firstName = data.driver_name ? (data.driver_name as string).split(" ")[0] : null;

  return Response.json({
    data: {
      id:          data.id,
      from:        data.from_city,
      to:          data.to_city,
      date:        data.travel_date,
      status:      data.status as string,
      driver_name: firstName,
      eta_min:     data.eta_min,
    },
    error: null,
  });
}
