import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

async function getOwner(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return null;
  return prisma.owner.findUnique({ where: { user_id: data.user.id } });
}

const createSchema = z.object({
  make:       z.string().min(1),
  model_name: z.string().min(1),
  number:     z.string().min(1),
  seats:      z.number().int().min(1).max(20).default(4),
});

export async function GET(req: NextRequest) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where:   { owner_id: owner.id },
    include: { driver: { include: { user: { select: { name: true, phone: true } } } } },
    orderBy: { created_at: "desc" },
  });
  return Response.json({ data: vehicles, error: null });
}

export async function POST(req: NextRequest) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (owner.status !== "ACTIVE") {
    return Response.json({ data: null, error: "Account not active" }, { status: 403 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: { ...parsed.data, owner_id: owner.id },
    });
    return Response.json({ data: vehicle, error: null }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002") {
      return Response.json({ data: null, error: "Vehicle number already registered" }, { status: 409 });
    }
    console.error("[fleet/vehicles POST]", err);
    return Response.json({ data: null, error: "Failed to create vehicle" }, { status: 500 });
  }
}
