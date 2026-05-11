import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const requests = await (prisma as any).rideRequest.findMany({
    where: { rider_id: user.id },
    orderBy: { created_at: "desc" },
    select: {
      id:           true,
      from_city:    true,
      to_city:      true,
      fare_paise:   true,
      travel_date:  true,
      status:       true,
      notes:        true,
      driver_name:  true,
      driver_phone: true,
      eta_min:      true,
      created_at:   true,
    },
  });

  return Response.json({ data: requests, error: null });
}

const createSchema = z.object({
  from_city:   z.string().min(1).max(100),
  to_city:     z.string().min(1).max(100),
  fare_paise:  z.number().int().min(100),
  travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:       z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { from_city, to_city, fare_paise, travel_date, notes } = parsed.data;

  // Ensure the rider exists in our User table (upsert by phone)
  const phone = user.phone ?? "";
  const rider = await (prisma as any).user.upsert({
    where:  { id: user.id },
    update: {},
    create: {
      id:    user.id,
      phone: phone || `unknown-${user.id.slice(0, 8)}`,
      role:  "RIDER",
    },
  });

  const request = await (prisma as any).rideRequest.create({
    data: {
      rider_id:    rider.id,
      rider_phone: phone,
      from_city,
      to_city,
      fare_paise,
      travel_date: new Date(travel_date),
      notes:       notes ?? null,
    },
  });

  return Response.json({ data: { id: request.id, status: request.status }, error: null });
}
