import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
  const eventType = event.event;

  if (eventType === "payment.captured") {
    const paymentEntity = (event.payload as { payment?: { entity?: Record<string, unknown> } })
      .payment?.entity;
    const razorpayOrderId   = paymentEntity?.order_id as string;
    const razorpayPaymentId = paymentEntity?.id as string;
    const method            = paymentEntity?.method as string;

    const payment = await prisma.payment.findUnique({
      where: { razorpay_order_id: razorpayOrderId },
      include: {
        booking: {
          include: {
            rider: true,
            ride:  { include: { driver: true } },
          },
        },
      },
    });

    if (!payment) return;

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  {
          status:              "SUCCESS",
          razorpay_payment_id: razorpayPaymentId,
          method,
        },
      }),
      prisma.booking.update({
        where: { id: payment.booking_id },
        data:  { status: "CONFIRMED" },
      }),
    ]);

    const booking = payment.booking;
    const ride    = booking.ride;
    const rider   = booking.rider;
    const driver  = ride.driver;

    const depDate = format(ride.departure_time, "d MMM yyyy");
    const depTime = format(ride.departure_time, "h:mm a");

    // Notify rider
    if (rider.phone) {
      await notifyRiderBookingConfirmed({
        phone:       rider.phone,
        name:        rider.name ?? "Rider",
        from:        ride.from_city,
        to:          ride.to_city,
        date:        depDate,
        time:        depTime,
        driverName:  driver.name ?? "Driver",
        driverPhone: driver.phone,
        seats:       booking.seats,
        amount:      Math.round(booking.amount_paise / 100),
      });
    }

    // Notify driver
    if (driver.phone) {
      await notifyDriverNewBooking({
        phone:       driver.phone,
        riderName:   rider.name ?? "Rider",
        riderPhone:  rider.phone,
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

    const payment = await prisma.payment.findUnique({
      where: { razorpay_order_id: razorpayOrderId },
      include: { booking: { include: { ride: true } } },
    });

    if (!payment) return;

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  { status: "FAILED" },
      }),
      prisma.booking.update({
        where: { id: payment.booking_id },
        data:  { status: "CANCELLED" },
      }),
      prisma.ride.update({
        where: { id: payment.booking.ride_id },
        data:  { available_seats: { increment: payment.booking.seats } },
      }),
    ]);
  }

  if (eventType === "refund.processed") {
    const refundEntity = (event.payload as { refund?: { entity?: Record<string, unknown> } })
      .refund?.entity;
    const razorpayPaymentId = refundEntity?.payment_id as string;

    const payment = await prisma.payment.findFirst({
      where: { razorpay_payment_id: razorpayPaymentId },
    });

    if (!payment) return;

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  { status: "REFUNDED" },
      }),
      prisma.booking.update({
        where: { id: payment.booking_id },
        data:  { status: "REFUNDED" },
      }),
    ]);
  }
}
