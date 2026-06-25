import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("CarInquiry")
      .select("*")
      .eq("listing_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/used-cars/:id/inquiries GET]", err);
    return Response.json({ data: null, error: "Failed to fetch inquiries" }, { status: 500 });
  }
}
