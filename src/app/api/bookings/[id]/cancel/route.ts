import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyCancellation } from "@/lib/notifications";
import { getAdminClient } from "@/lib/supabase";
import { refundPayment } from "@/lib/razorpay";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user } } = await getAdminClient().auth.getUser(token);
  if (!user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { rider: true, ride: true, payment: true },
    });

    if (!booking) {
      return Response.json({ data: null, error: "Booking not found" }, { status: 404 });
    }

    if (booking.rider_id !== user.id) {
      return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return Response.json({ data: null, error: "Booking cannot be cancelled" }, { status: 409 });
    }

    const CANCEL_FEE_PAISE = 5000;
    const minutesSinceCreated = (Date.now() - new Date(booking.created_at).getTime()) / 60_000;
    const cancelFee = minutesSinceCreated > 5 ? CANCEL_FEE_PAISE : 0;

    await prisma.$transaction([
      prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } }),
      prisma.ride.update({ where: { id: booking.ride_id }, data: { available_seats: { increment: booking.seats } } }),
    ]);

    if (booking.payment?.status === "SUCCESS" && booking.payment?.razorpay_payment_id) {
      try {
        const refundAmount = Math.max(0, booking.amount_paise - cancelFee);
        if (refundAmount > 0) {
          await refundPayment(booking.payment.razorpay_payment_id, refundAmount);
        }
        await prisma.payment.update({ where: { id: booking.payment.id }, data: { status: "REFUNDED" } });
        await prisma.booking.update({ where: { id }, data: { status: "REFUNDED" } });
      } catch (refundErr) {
        console.error("[bookings/cancel] refund failed", refundErr);
      }
    }

    if (booking.rider.phone) {
      await notifyCancellation(booking.rider.phone, booking.rider.name ?? "Rider", booking.id, Math.round(booking.amount_paise / 100));
    }

    return Response.json({ data: { cancelled: true, cancel_fee_paise: cancelFee }, error: null });
  } catch (err) {
    console.error("[bookings/cancel]", err);
    return Response.json({ data: null, error: "Cancellation failed" }, { status: 500 });
  }
}
