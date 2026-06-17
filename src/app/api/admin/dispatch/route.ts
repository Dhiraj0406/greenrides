import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("DriverDispatch")
      .select("*, request:request_id(from_city, to_city, fare_paise, travel_date, status), driver:driver_id(name, phone)")
      .eq("status", "PENDING")
      .order("dispatched_at", { ascending: true });

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/dispatch GET]", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

const postSchema = z.object({
  request_id:     z.string().uuid(),
  driver_user_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { request_id, driver_user_id } = parsed.data;

  try {
    const db = getAdminClient();

    // Verify the request exists and is dispatchable
    const { data: request } = await db
      .from("RideRequest")
      .select("id, status")
      .eq("id", request_id)
      .single();

    if (!request) return Response.json({ error: "RideRequest not found" }, { status: 404 });
    if (request.status !== "PENDING") {
      return Response.json({ error: `RideRequest is ${request.status}, cannot dispatch` }, { status: 400 });
    }

    // Verify driver exists
    const { data: driver } = await db
      .from("User")
      .select("id")
      .eq("id", driver_user_id)
      .single();

    if (!driver) return Response.json({ error: "Driver not found" }, { status: 404 });

    // Determine next order_index for this request
    const { data: existing } = await db
      .from("DriverDispatch")
      .select("order_index")
      .eq("request_id", request_id)
      .order("order_index", { ascending: false })
      .limit(1);

    const order_index = ((existing?.[0]?.order_index ?? -1) as number) + 1;
    const expires_at  = new Date(Date.now() + 5 * 60_000).toISOString();

    const { data: dispatch, error: insertErr } = await db
      .from("DriverDispatch")
      .insert({ request_id, driver_id: driver_user_id, order_index, status: "PENDING", expires_at })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Mark the request as dispatched
    await db.from("RideRequest").update({ dispatched: true }).eq("id", request_id);

    return Response.json({ data: dispatch, error: null });
  } catch (err) {
    console.error("[admin/dispatch POST]", err);
    return Response.json({ error: "Failed to create dispatch" }, { status: 500 });
  }
}
