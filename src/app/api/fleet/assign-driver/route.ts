import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data } = await getAdminClient().auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const owner = await prisma.owner.findUnique({ where: { user_id: data.user.id } });
  if (!owner || owner.status !== "ACTIVE") {
    return Response.json({ data: null, error: "Owner account required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { vehicle_id, driver_profile_id } = body as {
    vehicle_id?: string; driver_profile_id?: string | null;
  };
  if (!vehicle_id) return Response.json({ data: null, error: "vehicle_id required" }, { status: 400 });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicle_id, owner_id: owner.id } });
  if (!vehicle) return Response.json({ data: null, error: "Vehicle not found" }, { status: 404 });

  const updated = await prisma.vehicle.update({
    where: { id: vehicle_id },
    data:  { driver_id: driver_profile_id ?? null },
  });
  return Response.json({ data: updated, error: null });
}
