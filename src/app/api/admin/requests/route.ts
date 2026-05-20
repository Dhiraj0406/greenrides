import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");

  try {
    const requests = await prisma.rideRequest.findMany({
      where:   status ? { status } : undefined,
      include: {
        rider: { select: { name: true, phone: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return Response.json({ data: requests, error: null });
  } catch (err) {
    console.error("[admin/requests GET]", err);
    return Response.json({ data: null, error: "Failed to fetch requests" }, { status: 500 });
  }
}
