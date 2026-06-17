import { NextRequest } from "next/server";
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

  const db = getAdminClient();
  try {
    const { data: notifications, error } = await db
      .from("Notification")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    const unread = (notifications ?? []).filter((n: { read: boolean }) => !n.read).length;
    return Response.json({ data: { notifications: notifications ?? [], unread }, error: null });
  } catch (err) {
    console.error("[fleet/notifications GET]", err);
    return Response.json({ data: null, error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ids } = body as { ids?: string[] };
  if (!Array.isArray(ids)) {
    return Response.json({ data: null, error: "ids array required" }, { status: 400 });
  }

  const db = getAdminClient();
  try {
    const { error } = await db
      .from("Notification")
      .update({ read: true })
      .in("id", ids)
      .eq("user_id", userId);

    if (error) throw error;
    return Response.json({ data: { marked: ids.length }, error: null });
  } catch (err) {
    console.error("[fleet/notifications PATCH]", err);
    return Response.json({ data: null, error: "Failed to mark notifications" }, { status: 500 });
  }
}
