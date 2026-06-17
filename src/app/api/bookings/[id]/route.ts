import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

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

  try {
    const { data: booking } = await db
      .from("Booking")
      .select("id, amount_paise, pickup_point, status, ride_id, rider_id")
      .eq("id", id)
      .maybeSingle();

    if (!booking) {
      return Response.json({ data: null, error: "Booking not found" }, { status: 404 });
    }
    if (booking.rider_id !== user.id) {
      return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    const [rideRes, paymentRes] = await Promise.all([
      db.from("Ride").select("from_city, to_city, departure_time, driver_id").eq("id", booking.ride_id).single(),
      db.from("Payment").select("razorpay_order_id").eq("booking_id", id).maybeSingle(),
    ]);

    const ride = rideRes.data;
    if (!ride) {
      return Response.json({ data: null, error: "Ride not found" }, { status: 404 });
    }

    const [driverRes, driverProfileRes] = await Promise.all([
      db.from("User").select("name, phone").eq("id", ride.driver_id).maybeSingle(),
      db.from("DriverProfile").select("vehicle_number").eq("user_id", ride.driver_id).maybeSingle(),
    ]);

    const data = {
      booking_id:        booking.id,
      razorpay_order_id: paymentRes.data?.razorpay_order_id ?? "",
      amount_paise:      booking.amount_paise,
      from:              ride.from_city,
      to:                ride.to_city,
      departure_time:    ride.departure_time,
      driver_name:       driverRes.data?.name  ?? "Driver",
      driver_phone:      driverRes.data?.phone ?? "",
      vehicle_number:    driverProfileRes.data?.vehicle_number ?? "",
      pickup_point:      booking.pickup_point,
      status:            booking.status,
    };

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[bookings/[id] GET]", err);
    return Response.json({ data: null, error: "Failed to fetch booking" }, { status: 500 });
  }
}
