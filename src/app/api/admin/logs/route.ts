import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity");
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);

    let query = db
      .from("AdminLog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (entity) query = query.eq("entity", entity);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ data: data ?? [], error: null });
  } catch (err) {
    console.error("[admin/logs GET]", err);
    return Response.json({ data: null, error: "Failed to fetch logs" }, { status: 500 });
  }
}
