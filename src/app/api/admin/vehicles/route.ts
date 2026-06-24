import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const createVehicleSchema = z.object({
  owner_id:   z.string().uuid(),
  make:       z.string().min(1),
  model_name: z.string().min(1),
  number:     z.string().min(4),
  seats:      z.number().int().min(2).max(60).default(4),
  driver_id:  z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = createVehicleSchema.safeParse(body);
  if (!parsed.success) return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("Vehicle")
      .insert({
        owner_id:   parsed.data.owner_id,
        make:       parsed.data.make,
        model_name: parsed.data.model_name,
        number:     parsed.data.number.toUpperCase(),
        seats:      parsed.data.seats,
        active:     true,
        driver_id:  parsed.data.driver_id ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return Response.json({ data: null, error: "Vehicle number already registered" }, { status: 409 });
      throw error;
    }

    await db.from("AdminLog").insert({
      admin_id:  "admin",
      action:    "vehicle_added",
      entity:    "vehicle",
      entity_id: data.id,
      details:   { make: data.make, model_name: data.model_name, number: data.number, owner_id: parsed.data.owner_id },
    });

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/vehicles POST]", err);
    return Response.json({ data: null, error: "Failed to create vehicle" }, { status: 500 });
  }
}

const BUCKET = "kyc-documents";
const SIGNED_URL_TTL = 3600;

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data: vehicles, error } = await db
      .from("Vehicle")
      .select("*, owner:owner_id(name, phone, user:user_id(name, phone)), driver:driver_id(user:user_id(name, phone))")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = await Promise.all(
      (vehicles ?? []).map(async (v) => {
        const photoUrls = v.photos?.length
          ? await Promise.all(
              (v.photos as string[]).map((path: string) =>
                db.storage
                  .from(BUCKET)
                  .createSignedUrl(path, SIGNED_URL_TTL)
                  .then((r) => r.data?.signedUrl ?? null),
              ),
            )
          : [];

        return {
          id:         v.id,
          make:       v.make,
          model_name: v.model_name,
          number:     v.number,
          seats:      v.seats,
          active:     v.active,
          photos:     photoUrls.filter(Boolean),
          owner:      v.owner ? { name: (v.owner as { user?: { name?: string; phone?: string } })?.user?.name ?? null, phone: (v.owner as { user?: { name?: string; phone?: string } })?.user?.phone ?? null } : null,
          driver:     v.driver ? { name: (v.driver as { user?: { name?: string; phone?: string } })?.user?.name ?? null, phone: (v.driver as { user?: { name?: string; phone?: string } })?.user?.phone ?? null } : null,
          created_at: v.created_at,
        };
      }),
    );

    return Response.json({ data: rows, error: null });
  } catch (err) {
    console.error("[admin/vehicles GET]", err);
    return Response.json({ data: null, error: "Failed to fetch vehicles" }, { status: 500 });
  }
}
