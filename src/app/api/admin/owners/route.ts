import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("Owner")
      .select("*, user:user_id(name, phone), Vehicle(id, active)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/owners GET]", err);
    return Response.json({ data: null, error: "Failed to fetch owners" }, { status: 500 });
  }
}

const createOwnerSchema = z.object({
  name:  z.string().min(2),
  phone: z.string().regex(/^\d{10}$/, "Enter 10-digit phone without country code"),
  email: z.string().email().optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = createOwnerSchema.safeParse(body);
  if (!parsed.success) return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });

  const d  = parsed.data;
  const db = getAdminClient();

  try {
    let userId: string;
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      phone:         `+91${d.phone}`,
      phone_confirm: true,
      user_metadata: { name: d.name },
    });

    if (createErr) {
      const { data: existing } = await db.from("User").select("id").eq("phone", d.phone).maybeSingle();
      if (!existing) return Response.json({ data: null, error: createErr.message }, { status: 400 });
      userId = existing.id;
    } else {
      userId = created.user.id;
    }

    await db.from("User").upsert(
      { id: userId, phone: d.phone, name: d.name, email: d.email ?? null, role: "OWNER" },
      { onConflict: "id" }
    );

    const { data: ownerData, error: ownerErr } = await db.from("Owner").upsert(
      { user_id: userId, name: d.name, phone: d.phone, email: d.email ?? null, status: "ACTIVE" },
      { onConflict: "user_id" }
    ).select().single();

    if (ownerErr) throw ownerErr;

    const { data: existingAuth } = await db.auth.admin.getUserById(userId);
    const existingMeta  = existingAuth?.user?.app_metadata ?? {};
    const existingRoles = (existingMeta.roles as string[] | undefined) ?? [];
    const mergedRoles   = [...new Set([...existingRoles, "owner"])];

    await db.auth.admin.updateUserById(userId, {
      app_metadata: { ...existingMeta, roles: mergedRoles, fleet_status: "active" },
    });

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    "owner_created",
      entity:    "owner",
      entity_id: ownerData.id,
      details:   { name: d.name, phone: d.phone },
    });

    return Response.json({ data: { id: userId, owner_id: ownerData.id, created: true }, error: null });
  } catch (err) {
    console.error("[admin/owners POST]", err);
    return Response.json({ data: null, error: "Failed to create owner" }, { status: 500 });
  }
}
