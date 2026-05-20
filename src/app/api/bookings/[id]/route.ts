import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        ride: {
          include: {
            driver: {
              select: {
                name:           true,
                phone:          true,
                driver_profile: true,
              },
            },
          },
        },
        rider:   { select: { name: true, phone: true } },
        payment: true,
      },
    });

    if (!booking) {
      return Response.json(
        { data: null, error: "Booking not found" },
        { status: 404 }
      );
    }

    const data = {
      booking_id:        booking.id,
      razorpay_order_id: booking.payment?.razorpay_order_id ?? "",
      amount_paise:      booking.amount_paise,
      from:              booking.ride.from_city,
      to:                booking.ride.to_city,
      departure_time:    booking.ride.departure_time.toISOString(),
      driver_name:       booking.ride.driver.name ?? "Driver",
      driver_phone:      booking.ride.driver.phone,
      vehicle_number:    booking.ride.driver.driver_profile?.vehicle_number ?? "",
      pickup_point:      booking.pickup_point,
      status:            booking.status,
    };

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[bookings/[id] GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}
