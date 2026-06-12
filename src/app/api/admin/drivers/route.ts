import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminClient();
    const { searchParams } = new URL(req.url);
    const approved = searchParams.get("approved");
    const q        = searchParams.get("q") ?? "";

    let query = db
      .from("DriverProfile")
      .select("id, user_id, is_approved, is_online, vehicle_type, vehicle_number, vehicle_model, license_number, avg_rating, total_trips, user:User(name, phone)")
      .order("created_at", { ascending: false });

    if (approved === "1") query = query.eq("is_approved", true);
    if (q) query = query.or(`User.name.ilike.%${q}%,User.phone.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ data: data ?? [], error: null });
  } catch (err) {
    console.error("[admin/drivers GET]", err);
    return Response.json({ data: null, error: "Failed to fetch drivers" }, { status: 500 });
  }
}

const createSchema = z.object({
  name:           z.string().min(2),
  phone:          z.string().regex(/^\d{10}$/, "Enter 10-digit phone without country code"),
  license_number: z.string().min(2),
  vehicle_type:   z.string().min(1),
  vehicle_number: z.string().min(4),
  vehicle_model:  z.string().min(2),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d  = parsed.data;
  const db = getAdminClient();

  try {
    // 1. Create (or find existing) Supabase auth user
    let userId: string;
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      phone:         `+91${d.phone}`,
      phone_confirm: true,
      user_metadata: { name: d.name },
    });

    if (createErr) {
      // If phone already registered, look up by phone in User table
      const { data: existing } = await db
        .from("User")
        .select("id")
        .eq("phone", d.phone)
        .maybeSingle();
      if (!existing) {
        return Response.json({ data: null, error: createErr.message }, { status: 400 });
      }
      userId = existing.id;
    } else {
      userId = created.user.id;
    }

    // 2. Upsert User row (same as /api/users/me on first login)
    await db.from("User").upsert(
      { id: userId, phone: d.phone, name: d.name, role: "RIDER" },
      { onConflict: "id" }
    );

    // 3. Upsert DriverProfile — auto-approved since admin is adding
    const { error: profileErr } = await db.from("DriverProfile").upsert(
      {
        user_id:        userId,
        license_number: d.license_number,
        vehicle_type:   d.vehicle_type,
        vehicle_number: d.vehicle_number,
        vehicle_model:  d.vehicle_model,
        is_approved:    true,
        is_online:      false,
      },
      { onConflict: "user_id" }
    );
    if (profileErr) throw profileErr;

    // 4. Set fleet role + active status in app_metadata
    await db.auth.admin.updateUserById(userId, {
      app_metadata: { roles: ["driver"], fleet_status: "active" },
    });

    return Response.json({ data: { id: userId, created: true }, error: null });
  } catch (err) {
    console.error("[admin/drivers POST]", err);
    return Response.json({ data: null, error: "Failed to create driver" }, { status: 500 });
  }
}
