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

  const { id } = await params;
  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("OwnerPayout")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "PENDING")
      .select()
      .maybeSingle();

    if (!data && !error) {
      return Response.json({ data: null, error: "Payout already paid or not found" }, { status: 409 });
    }

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/payouts/:id PATCH]", err);
    return Response.json({ data: null, error: "Failed to update payout" }, { status: 500 });
  }
}
