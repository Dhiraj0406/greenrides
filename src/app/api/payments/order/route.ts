import { NextRequest } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/razorpay";

const schema = z.object({
  amount_paise: z.number().int().min(100),
  booking_id:   z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(
      parsed.data.amount_paise,
      parsed.data.booking_id
    );
    return Response.json({
      data: { order_id: order.id, amount: order.amount, currency: order.currency },
      error: null,
    });
  } catch (err) {
    console.error("[payments/order]", err);
    return Response.json(
      { data: null, error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
