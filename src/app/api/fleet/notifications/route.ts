import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await getAdminClient().auth.getUser(token);
  return data.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where:   { user_id: userId },
    orderBy: { created_at: "desc" },
    take:    50,
  });
  const unread = notifications.filter((n) => !n.read).length;
  return Response.json({ data: { notifications, unread }, error: null });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ids } = body as { ids?: string[] };
  if (!Array.isArray(ids)) {
    return Response.json({ data: null, error: "ids array required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: { in: ids }, user_id: userId },
    data:  { read: true },
  });
  return Response.json({ data: { marked: ids.length }, error: null });
}
