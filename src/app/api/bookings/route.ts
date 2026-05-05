import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/razorpay";

const schema = z.object({
  ride_id:     z.string().uuid(),
  rider_id:    z.string().uuid(),
  seats:       z.number().int().min(1).max(6),
  pickup_point: z.string().min(2),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { data: null, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { ride_id, rider_id, seats, pickup_point } = parsed.data;

  try {
    // Atomic seat booking via Supabase RPC
    const { data, error } = await (await import("@/lib/supabase")).supabase.rpc(
      "create_booking",
      {
        p_ride_id:  ride_id,
        p_rider_id: rider_id,
        p_seats:    seats,
        p_pickup:   pickup_point,
      }
    );

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("not enough seats")) {
        return Response.json(
          { data: null, error: "Not enough seats available" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    const { booking_id, amount_paise } = data as {
      booking_id: string;
      amount_paise: number;
    };

    // Create Razorpay order
    const order = await createOrder(amount_paise, booking_id);

    // Store order ID in Payment table
    await prisma.payment.create({
      data: {
        booking_id:       booking_id,
        razorpay_order_id: order.id,
        amount_paise,
        status:           "PENDING",
      },
    });

    return Response.json({
      data: {
        booking_id,
        razorpay_order_id: order.id,
        amount_paise,
      },
      error: null,
    }, { status: 201 });

  } catch (err) {
    console.error("[bookings POST]", err);
    return Response.json(
      { data: null, error: "Booking failed. Please try again." },
      { status: 500 }
    );
  }
}
