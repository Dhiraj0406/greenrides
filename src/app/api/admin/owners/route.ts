import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const owners = await prisma.owner.findMany({
    include: {
      user:     { select: { name: true, phone: true } },
      vehicles: { select: { id: true, active: true } },
    },
    orderBy: { created_at: "desc" },
  });
  return Response.json({ data: owners, error: null });
}
