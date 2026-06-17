import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

async function getOwner(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: owner } = await db
    .from("Owner")
    .select("id, status")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return owner;
}

const createSchema = z.object({
  make:       z.string().min(1),
  model_name: z.string().min(1),
  number:     z.string().min(1),
  seats:      z.number().int().min(1).max(20).default(4),
});

export async function GET(req: NextRequest) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  try {
    const { data: vehicles, error } = await db
      .from("Vehicle")
      .select("*")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ data: vehicles ?? [], error: null });
  } catch (err) {
    console.error("[fleet/vehicles GET]", err);
    return Response.json({ data: null, error: "Failed to fetch vehicles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (owner.status !== "ACTIVE") {
    return Response.json({ data: null, error: "Account not active" }, { status: 403 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = getAdminClient();
  try {
    const { data: vehicle, error } = await db
      .from("Vehicle")
      .insert({ ...parsed.data, owner_id: owner.id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ data: null, error: "Vehicle number already registered" }, { status: 409 });
      }
      throw error;
    }
    return Response.json({ data: vehicle, error: null }, { status: 201 });
  } catch (err) {
    console.error("[fleet/vehicles POST]", err);
    return Response.json({ data: null, error: "Failed to create vehicle" }, { status: 500 });
  }
}
