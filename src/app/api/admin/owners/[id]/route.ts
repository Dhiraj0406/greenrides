import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id }     = await params;
  const body       = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!["ACTIVE", "SUSPENDED"].includes(status ?? "")) {
    return Response.json({ data: null, error: "status must be ACTIVE or SUSPENDED" }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("Owner")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/owners/:id PATCH]", err);
    return Response.json({ data: null, error: "Failed to update owner" }, { status: 500 });
  }
}
