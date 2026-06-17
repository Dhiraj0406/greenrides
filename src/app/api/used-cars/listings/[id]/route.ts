import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(l: any) {
  return { ...l, price_paise: String(l.price_paise) };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = getAdminClient();
  const { data: listing } = await db
    .from("CarListing")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!listing || listing.status === "PENDING" || listing.status === "REJECTED") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: serialize(listing), error: null });
}
