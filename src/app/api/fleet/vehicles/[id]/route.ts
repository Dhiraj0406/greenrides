import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

async function getOwner(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return null;
  return prisma.owner.findUnique({ where: { user_id: data.user.id } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({ where: { id, owner_id: owner.id } });
  if (!vehicle) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { active, driver_id } = body as { active?: boolean; driver_id?: string | null };

  const updated = await prisma.vehicle.update({
    where: { id },
    data:  {
      ...(active !== undefined ? { active } : {}),
      ...(driver_id !== undefined ? { driver_id } : {}),
    },
  });
  return Response.json({ data: updated, error: null });
}
