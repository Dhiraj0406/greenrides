import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payout = await prisma.ownerPayout.update({
    where: { id },
    data:  { status: "PAID", paid_at: new Date() },
  });
  return Response.json({ data: payout, error: null });
}
