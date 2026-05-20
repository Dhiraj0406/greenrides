import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data } = await getAdminClient().auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.driverProfile.findUnique({
    where:   { user_id: data.user.id },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!profile) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  return Response.json({
    data: {
      name:           profile.user.name,
      phone:          profile.user.phone,
      vehicle_type:   profile.vehicle_type,
      vehicle_number: profile.vehicle_number,
      vehicle_model:  profile.vehicle_model,
      avg_rating:     profile.avg_rating,
      total_trips:    profile.total_trips,
      is_online:      profile.is_online,
    },
    error: null,
  });
}
