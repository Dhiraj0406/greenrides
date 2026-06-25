import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { verifyPaymentSignature } from "@/lib/razorpay";

const schema = z.object({
  razorpay_order_id:   z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature:  z.string(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) return Response.json({ data: null, error: "Invalid payment signature" }, { status: 400 });

  const now = new Date().toISOString();

  const { data: rideReq } = await db
    .from("RideRequest")
    .select("rider_id, razorpay_order_id, from_city, to_city")
    .eq("id", requestId)
    .single();

  if (!rideReq || rideReq.rider_id !== user.id) {
    return Response.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  if (rideReq.razorpay_order_id !== razorpay_order_id) {
    return Response.json({ data: null, error: "Order ID mismatch" }, { status: 400 });
  }

  await db
    .from("RideRequest")
    .update({ razorpay_payment_id, payment_status: "SUCCESS", updated_at: now })
    .eq("id", requestId);

  return Response.json({ data: { paid: true }, error: null });
}
