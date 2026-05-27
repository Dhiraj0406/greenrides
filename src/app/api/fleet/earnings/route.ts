import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const owner = await prisma.owner.findUnique({ where: { user_id: data.user.id } });
  if (!owner) return Response.json({ data: null, error: "Not an owner" }, { status: 403 });

  // vehicles → driverProfile IDs → user IDs → rides
  const vehicles = await prisma.vehicle.findMany({
    where:  { owner_id: owner.id, driver_id: { not: null } },
    select: { driver_id: true },
  });
  const driverProfileIds = vehicles.map((v) => v.driver_id!);
  const driverProfiles   = await prisma.driverProfile.findMany({
    where:  { id: { in: driverProfileIds } },
    select: { user_id: true },
  });
  const driverUserIds = driverProfiles.map((d) => d.user_id);

  const [bookings, payouts] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ride:   { driver_id: { in: driverUserIds } },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      include: { ride: { select: { from_city: true, to_city: true, departure_time: true } } },
      orderBy: { created_at: "desc" },
      take:    100,
    }),
    prisma.ownerPayout.findMany({
      where:   { owner_id: owner.id },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const totalEarned = bookings.reduce((s, b) => s + b.amount_paise, 0);
  return Response.json({ data: { bookings, payouts, totalEarned }, error: null });
}
