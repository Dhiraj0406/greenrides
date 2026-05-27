import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  request_id: z.string().uuid(),
  lat:        z.number().min(-90).max(90),
  lng:        z.number().min(-180).max(180),
  heading:    z.number().min(0).max(360).optional(),
});

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { request_id, lat, lng, heading } = parsed.data;

  // Verify driver has an ACCEPTED dispatch for this request
  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", request_id)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) {
    return Response.json({ error: "No active dispatch found" }, { status: 403 });
  }

  // Verify request is IN_PROGRESS
  const { data: request } = await db
    .from("RideRequest")
    .select("status")
    .eq("id", request_id)
    .eq("status", "IN_PROGRESS")
    .maybeSingle();

  if (!request) {
    return Response.json({ error: "Trip not in progress" }, { status: 403 });
  }

  await db.from("DriverLocation").upsert(
    {
      request_id,
      driver_id:  user.id,
      lat,
      lng,
      heading:    heading ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "request_id" }
  );

  return Response.json({ ok: true });
}
