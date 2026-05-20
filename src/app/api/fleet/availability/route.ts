import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function PATCH(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { is_online } = body as { is_online?: boolean };
  if (typeof is_online !== "boolean") {
    return Response.json({ data: null, error: "is_online (boolean) required" }, { status: 400 });
  }

  const profile = await prisma.driverProfile.findUnique({ where: { user_id: data.user.id } });
  if (!profile || !profile.is_approved) {
    return Response.json({ data: null, error: "Not a driver" }, { status: 403 });
  }

  await prisma.driverProfile.update({ where: { user_id: data.user.id }, data: { is_online } });
  return Response.json({ data: { is_online }, error: null });
}
