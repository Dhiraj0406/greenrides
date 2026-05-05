import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyCancellation } from "@/lib/notifications";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { rider: true, ride: true, payment: true },
    });

    if (!booking) {
      return Response.json(
        { data: null, error: "Booking not found" },
        { status: 404 }
      );
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return Response.json(
        { data: null, error: "Booking cannot be cancelled" },
        { status: 409 }
      );
    }

    // Cancel in transaction: restore seats + update booking
    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data:  { status: "CANCELLED" },
      }),
      prisma.ride.update({
        where: { id: booking.ride_id },
        data:  { available_seats: { increment: booking.seats } },
      }),
    ]);

    // Notify rider
    if (booking.rider.phone) {
      await notifyCancellation(
        booking.rider.phone,
        booking.rider.name ?? "Rider",
        booking.id,
        Math.round(booking.amount_paise / 100)
      );
    }

    return Response.json({ data: { cancelled: true }, error: null });
  } catch (err) {
    console.error("[bookings/cancel]", err);
    return Response.json(
      { data: null, error: "Cancellation failed" },
      { status: 500 }
    );
  }
}
