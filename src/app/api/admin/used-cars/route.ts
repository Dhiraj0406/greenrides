import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status") || undefined;

  try {
    const db = getAdminClient();
    let query = db
      .from("CarListing")
      .select("*, inquiries:CarInquiry(count)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).map(({ inquiries, price_paise, ...l }) => ({
      ...l,
      price_paise:   String(price_paise),
      inquiry_count: Array.isArray(inquiries) ? (inquiries[0] as { count: number })?.count ?? 0 : 0,
    }));

    return Response.json({ data: rows, error: null });
  } catch (err) {
    console.error("[admin/used-cars GET]", err);
    return Response.json({ data: null, error: "Failed to fetch listings" }, { status: 500 });
  }
}
