import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const type = new URL(req.url).searchParams.get("type") ?? "request";

  if (type === "request") {
    const { data } = await db
      .from("RideRequest")
      .select("id, from_city, to_city, fare_paise, travel_date, driver_name, driver_phone, payment_status, created_at")
      .eq("id", id)
      .eq("rider_id", user.id)
      .eq("status", "COMPLETED")
      .maybeSingle();

    if (!data) return Response.json({ data: null, error: "Receipt not found" }, { status: 404 });

    return Response.json({
      data: {
        type:           "request",
        ref:            id.replace(/-/g, "").slice(0, 8).toUpperCase(),
        from:           data.from_city,
        to:             data.to_city,
        fare_rupees:    Math.round(data.fare_paise / 100),
        date:           data.travel_date,
        driver_name:    data.driver_name,
        driver_phone:   data.driver_phone,
        payment_status: data.payment_status,
        booked_at:      data.created_at,
      },
      error: null,
    });
  }

  if (type === "booking") {
    const { data: booking } = await db
      .from("Booking")
      .select("id, amount_paise, seats, pickup_point, created_at, ride_id")
      .eq("id", id)
      .eq("rider_id", user.id)
      .eq("status", "COMPLETED")
      .maybeSingle();

    if (!booking) return Response.json({ data: null, error: "Receipt not found" }, { status: 404 });

    const { data: ride } = await db
      .from("Ride")
      .select("from_city, to_city, departure_time, driver_id")
      .eq("id", booking.ride_id)
      .maybeSingle();

    let driverName: string | null = null;
    let vehicleNumber: string | null = null;
    let vehicleModel: string | null = null;

    if (ride?.driver_id) {
      const [{ data: driverUser }, { data: driverProfile }] = await Promise.all([
        db.from("User").select("name").eq("id", ride.driver_id).maybeSingle(),
        db.from("DriverProfile").select("vehicle_number, vehicle_model").eq("user_id", ride.driver_id).maybeSingle(),
      ]);
      driverName    = driverUser?.name    ?? null;
      vehicleNumber = driverProfile?.vehicle_number ?? null;
      vehicleModel  = driverProfile?.vehicle_model  ?? null;
    }

    return Response.json({
      data: {
        type:           "booking",
        ref:            id.replace(/-/g, "").slice(0, 8).toUpperCase(),
        from:           ride?.from_city ?? "",
        to:             ride?.to_city   ?? "",
        fare_rupees:    Math.round(booking.amount_paise / 100),
        seats:          booking.seats,
        date:           ride?.departure_time ?? booking.created_at,
        driver_name:    driverName,
        vehicle_number: vehicleNumber,
        vehicle_model:  vehicleModel,
        booked_at:      booking.created_at,
      },
      error: null,
    });
  }

  return Response.json({ data: null, error: "Invalid type" }, { status: 400 });
}
