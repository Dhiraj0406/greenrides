import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data: docs } = await db
    .from("Document")
    .select("id, doc_type, status, updated_at")
    .eq("entity_id", user.id)
    .order("updated_at", { ascending: false });

  return Response.json({ data: docs ?? [], error: null });
}
