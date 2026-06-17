import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const createSchema = z.object({
  owner_id:     z.string().uuid(),
  amount_paise: z.number().int().positive(),
  period_from:  z.string().datetime(),
  period_to:    z.string().datetime(),
});

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("OwnerPayout")
      .select("*, owner:owner_id(name, phone)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/payouts GET]", err);
    return Response.json({ data: null, error: "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("OwnerPayout")
      .insert(parsed.data)
      .select("*, owner:owner_id(name, phone)")
      .single();

    if (error) throw error;
    return Response.json({ data, error: null }, { status: 201 });
  } catch (err) {
    console.error("[admin/payouts POST]", err);
    return Response.json({ data: null, error: "Failed to create payout" }, { status: 500 });
  }
}
