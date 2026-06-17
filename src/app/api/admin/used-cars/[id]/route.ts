import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const db = getAdminClient();
    const { data: listing, error } = await db
      .from("CarListing")
      .select("id, make, model, year, price_paise, mileage_km, fuel_type, transmission, location, description, seller_name, seller_phone, status, photos, created_at")
      .eq("id", id)
      .single();

    if (error || !listing) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({
      data: { ...listing, price_paise: String(listing.price_paise) },
    });
  } catch (err) {
    console.error("[admin/used-cars/:id GET]", err);
    return Response.json({ error: "Failed to fetch listing" }, { status: 500 });
  }
}

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SOLD"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const db = getAdminClient();

    const { data: existing } = await db.from("CarListing").select("id").eq("id", id).single();
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const { error } = await db
      .from("CarListing")
      .update({ status: parsed.data.status })
      .eq("id", id);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/used-cars/:id PATCH]", err);
    return Response.json({ error: "Failed to update listing" }, { status: 500 });
  }
}
