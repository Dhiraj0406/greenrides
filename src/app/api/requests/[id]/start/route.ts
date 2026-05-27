import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  otp: z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "OTP must be a 6-digit number" }, { status: 400 });

  // Verify this driver is the ACCEPTED driver for this request
  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", requestId)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) {
    return Response.json({ error: "Not authorized or dispatch not found" }, { status: 403 });
  }

  // Fetch the request and validate OTP + status
  const { data: request } = await db
    .from("RideRequest")
    .select("id, status, trip_otp")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "CONFIRMED") {
    return Response.json({ error: "Ride is not in CONFIRMED state" }, { status: 400 });
  }

  if (!request.trip_otp || request.trip_otp !== parsed.data.otp) {
    return Response.json({ error: "Invalid OTP" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from("RideRequest")
    .update({ status: "IN_PROGRESS", started_at: now, updated_at: now })
    .eq("id", requestId)
    .eq("status", "CONFIRMED");

  if (updateErr) {
    console.error("[requests/start]", updateErr);
    return Response.json({ error: "Failed to start trip" }, { status: 500 });
  }

  return Response.json({ data: { started: true }, error: null });
}
