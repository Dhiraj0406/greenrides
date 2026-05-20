import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dispatches = await prisma.driverDispatch.findMany({
      where: { status: "PENDING" },
      include: {
        request: { select: { from_city: true, to_city: true, fare_paise: true, travel_date: true, status: true } },
        driver:  { select: { name: true, phone: true } },
      },
      orderBy: { dispatched_at: "asc" },
    });
    return Response.json({ data: dispatches, error: null });
  } catch (err) {
    console.error("[admin/dispatch GET]", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
