import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SOLD"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const listing = await prisma.carListing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.carListing.update({
    where: { id },
    data:  { status: parsed.data.status },
  });

  return Response.json({ ok: true });
}
