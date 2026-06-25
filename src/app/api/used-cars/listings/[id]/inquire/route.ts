import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const schema = z.object({
  buyer_name:  z.string().min(1).max(100),
  buyer_phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  message:     z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = getAdminClient();

  const { data: listing } = await db
    .from("CarListing")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!listing || listing.status !== "APPROVED") {
    return Response.json({ data: null, error: "Listing not available" }, { status: 403 });
  }

  const { error: insertErr } = await db.from("CarInquiry").insert({
    listing_id:  id,
    buyer_name:  parsed.data.buyer_name,
    buyer_phone: parsed.data.buyer_phone,
    message:     parsed.data.message ?? null,
  });

  if (insertErr) {
    console.error("[used-cars/inquire POST]", insertErr);
    return Response.json({ data: null, error: "Failed to submit inquiry" }, { status: 500 });
  }

  return Response.json({ data: { ok: true }, error: null });
}
