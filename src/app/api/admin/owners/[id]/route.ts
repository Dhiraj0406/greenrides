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

  const { id }     = await params;
  const body       = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!["ACTIVE", "SUSPENDED"].includes(status ?? "")) {
    return Response.json({ data: null, error: "status must be ACTIVE or SUSPENDED" }, { status: 400 });
  }

  const owner = await prisma.owner.update({
    where: { id },
    data:  { status: status as "ACTIVE" | "SUSPENDED" },
  });
  return Response.json({ data: owner, error: null });
}
