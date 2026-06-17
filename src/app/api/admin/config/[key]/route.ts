import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { invalidateFlag } from "@/modules/platform/db";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("app_remote_config")
      .update({ enabled: parsed.data.enabled })
      .eq("key", key)
      .select()
      .single();

    if (error) throw error;
    invalidateFlag(key);
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/config/:key PATCH]", err);
    return Response.json({ error: "Failed to update config" }, { status: 500 });
  }
}
