import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const createSchema = z.object({
  owner_id:     z.string().uuid(),
  amount_paise: z.number().int().positive(),
  period_from:  z.string().datetime(),
  period_to:    z.string().datetime(),
});

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const payouts = await prisma.ownerPayout.findMany({
    include: { owner: { include: { user: { select: { name: true, phone: true } } } } },
    orderBy: { created_at: "desc" },
  });
  return Response.json({ data: payouts, error: null });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const payout = await prisma.ownerPayout.create({ data: parsed.data });
  return Response.json({ data: payout, error: null }, { status: 201 });
}
