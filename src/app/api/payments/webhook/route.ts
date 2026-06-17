import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  notifyRiderBookingConfirmed,
  notifyDriverNewBooking,
} from "@/lib/notifications";
import { format } from "date-fns";

// Razorpay needs a fast 200 — do the heavy work with after()
export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { event: string; payload: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Process asynchronously — respond 200 immediately
  handleWebhookEvent(event).catch((e) =>
    console.error("[webhook] handler error:", e)
  );

  return new Response("OK", { status: 200 });
}

async function handleWebhookEvent(event: {
  event: string;
  payload: Record<string, unknown>;
}) {
  const db        = getAdminClient();
  const eventType = event.event;

  if (eventType === "payment.captured") {
    const paymentEntity = (event.payload as { payment?: { entity?: Record<string, unknown> } })
      .payment?.entity;
    const razorpayOrderId   = paymentEntity?.order_id as string;
    const razorpayPaymentId = paymentEntity?.id as string;
    const method            = paymentEntity?.method as string;

    const { data: payment } = await db
      .from("Payment")
      .select("id, booking_id")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (!payment) return;

    const { data: booking } = await db
      .from("Booking")
      .select("id, rider_id, ride_id, seats, amount_paise, pickup_point")
      .eq("id", payment.booking_id)
      .maybeSingle();

    if (!booking) return;

    const { data: ride } = await db
      .from("Ride")
      .select("id, driver_id, from_city, to_city, departure_time")
      .eq("id", booking.ride_id)
      .maybeSingle();

    if (!ride) return;

    const [{ data: rider }, { data: driver }] = await Promise.all([
      db.from("User").select("id, name, phone").eq("id", booking.rider_id).maybeSingle(),
      db.from("User").select("id, name, phone").eq("id", ride.driver_id).maybeSingle(),
    ]);

    await db.from("Payment").update({
      status:              "SUCCESS",
      razorpay_payment_id: razorpayPaymentId,
      method,
    }).eq("id", payment.id);

    await db.from("Booking").update({ status: "CONFIRMED" }).eq("id", payment.booking_id);

    const depDate = format(new Date(ride.departure_time), "d MMM yyyy");
    const depTime = format(new Date(ride.departure_time), "h:mm a");

    if (rider?.phone) {
      await notifyRiderBookingConfirmed({
        phone:       rider.phone,
        name:        rider.name ?? "Rider",
        from:        ride.from_city,
        to:          ride.to_city,
        date:        depDate,
        time:        depTime,
        driverName:  driver?.name ?? "Driver",
        driverPhone: driver?.phone ?? "",
        seats:       booking.seats,
        amount:      Math.round(booking.amount_paise / 100),
      });
    }

    if (driver?.phone) {
      await notifyDriverNewBooking({
        phone:       driver.phone,
        riderName:   rider?.name ?? "Rider",
        riderPhone:  rider?.phone ?? "",
        from:        ride.from_city,
        to:          ride.to_city,
        seats:       booking.seats,
        pickup:      booking.pickup_point,
        amount:      Math.round(booking.amount_paise / 100),
      });
    }
  }

  if (eventType === "payment.failed") {
    const paymentEntity = (event.payload as { payment?: { entity?: Record<string, unknown> } })
      .payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id as string;

    const { data: payment } = await db
      .from("Payment")
      .select("id, booking_id")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (!payment) return;

    const { data: booking } = await db
      .from("Booking")
      .select("id, ride_id, seats")
      .eq("id", payment.booking_id)
      .maybeSingle();

    if (!booking) return;

    await db.from("Payment").update({ status: "FAILED" }).eq("id", payment.id);
    await db.from("Booking").update({ status: "CANCELLED" }).eq("id", payment.booking_id);

    // Restore seats: read then write (no atomic increment in PostgREST)
    const { data: ride } = await db
      .from("Ride")
      .select("available_seats")
      .eq("id", booking.ride_id)
      .maybeSingle();

    if (ride) {
      await db.from("Ride")
        .update({ available_seats: (ride.available_seats ?? 0) + booking.seats })
        .eq("id", booking.ride_id);
    }
  }

  if (eventType === "refund.processed") {
    const refundEntity = (event.payload as { refund?: { entity?: Record<string, unknown> } })
      .refund?.entity;
    const razorpayPaymentId = refundEntity?.payment_id as string;

    const { data: payment } = await db
      .from("Payment")
      .select("id, booking_id")
      .eq("razorpay_payment_id", razorpayPaymentId)
      .maybeSingle();

    if (!payment) return;

    await db.from("Payment").update({ status: "REFUNDED" }).eq("id", payment.id);
    await db.from("Booking").update({ status: "REFUNDED" }).eq("id", payment.booking_id);
  }
}
