import Razorpay from "razorpay";
import crypto from "crypto";

function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export async function createOrder(amountPaise: number, bookingId: string) {
  return getRazorpay().orders.create({
    amount:   amountPaise,
    currency: "INR",
    receipt:  `bkg_${bookingId.slice(-12)}`,
    notes:    { bookingId },
  });
}

export async function refundPayment(paymentId: string, amountPaise: number): Promise<void> {
  await getRazorpay().payments.refund(paymentId, { amount: amountPaise, speed: "normal" });
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}
