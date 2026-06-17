import { NextRequest } from "next/server";
import { notifyCancellation } from "@/lib/notifications";
import { getAdminClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: booking } = await db
      .from("Booking")
      .select("id, rider_id, ride_id, seats, amount_paise, status, created_at")
      .eq("id", id)
      .maybeSingle();

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

    await db.from("Booking").update({ status: "CANCELLED" }).eq("id", id);

    const { data: ride } = await db.from("Ride").select("available_seats").eq("id", booking.ride_id).maybeSingle();
    if (ride) {
      await db.from("Ride").update({ available_seats: (ride.available_seats ?? 0) + booking.seats }).eq("id", booking.ride_id);
    }

    const { data: payment } = await db
      .from("Payment")
      .select("id, razorpay_payment_id, status")
      .eq("booking_id", id)
      .maybeSingle();

    if (payment?.status === "SUCCESS" && payment?.razorpay_payment_id) {
      try {
        const { refundPayment } = await import("@/lib/razorpay");
        const refundAmount = Math.max(0, booking.amount_paise - cancelFee);
        if (refundAmount > 0) {
          await refundPayment(payment.razorpay_payment_id, refundAmount);
        }
        await db.from("Payment").update({ status: "REFUNDED" }).eq("id", payment.id);
        await db.from("Booking").update({ status: "REFUNDED" }).eq("id", id);
      } catch (refundErr) {
        console.error("[bookings/cancel] refund failed", refundErr);
      }
    }

    const { data: rider } = await db.from("User").select("name, phone").eq("id", user.id).maybeSingle();
    if (rider?.phone) {
      await notifyCancellation(
        rider.phone,
        rider.name ?? "Rider",
        booking.id,
        Math.round(booking.amount_paise / 100)
      );
    }

    return Response.json({ data: { cancelled: true, cancel_fee_paise: cancelFee }, error: null });
  } catch (err) {
    console.error("[bookings/cancel]", err);
    return Response.json({ data: null, error: "Cancellation failed" }, { status: 500 });
  }
}
