import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("app_remote_config")
      .select("*")
      .order("module_scope", { ascending: true });

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/config GET]", err);
    return Response.json({ data: null, error: "Failed to fetch config" }, { status: 500 });
  }
}
