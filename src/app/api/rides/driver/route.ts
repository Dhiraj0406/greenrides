import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data } = await getAdminClient().auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const all  = req.nextUrl.searchParams.get("all") === "true";
  const date = req.nextUrl.searchParams.get("date");

  const where: Record<string, unknown> = { driver_id: data.user.id };
  if (!all && date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end   = new Date(`${date}T23:59:59.999Z`);
    where.departure_time = { gte: start, lte: end };
  }

  const rides = await prisma.ride.findMany({
    where,
    include: {
      bookings: {
        where:   { status: { in: ["CONFIRMED", "COMPLETED"] } },
        include: { rider: { select: { name: true, phone: true } } },
      },
    },
    orderBy: { departure_time: "desc" },
    take:    all ? 100 : 10,
  });

  return Response.json({ data: rides, error: null });
}
