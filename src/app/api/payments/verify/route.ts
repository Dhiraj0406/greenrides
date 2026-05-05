import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyPaymentSignature } from "@/lib/razorpay";

const schema = z.object({
  razorpay_order_id:   z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature:  z.string(),
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
      { data: null, error: "Missing payment fields" },
      { status: 400 }
    );
  }

  const valid = verifyPaymentSignature(
    parsed.data.razorpay_order_id,
    parsed.data.razorpay_payment_id,
    parsed.data.razorpay_signature
  );

  if (!valid) {
    return Response.json(
      { data: null, error: "Payment verification failed" },
      { status: 400 }
    );
  }

  return Response.json({ data: { verified: true }, error: null });
}
