import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-admin-token") !== process.env.ADMIN_SECRET) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getAdminClient();
    const { data: routes, error } = await db
      .from("RouteConfig")
      .select("id, from_city, to_city, base_fare, is_active, distance_km, duration_min, FareRule(*)")
      .order("from_city", { ascending: true })
      .order("to_city",   { ascending: true });

    if (error) throw error;
    return Response.json({ data: routes ?? [], error: null });
  } catch (err) {
    console.error("[fares GET]", err);
    return Response.json({ data: null, error: "Failed to fetch fares" }, { status: 500 });
  }
}

const putSchema = z.object({
  routes: z.array(
    z.object({
      id:        z.string().uuid(),
      base_fare: z.number().int().min(100).optional(),
      is_active: z.boolean().optional(),
      fare_rule: z
        .object({
          discount_pct:   z.number().int().min(0).max(100).optional(),
          discount_on:    z.boolean().optional(),
          discount_label: z.string().max(50).optional(),
          global_offer:   z.boolean().optional(),
        })
        .optional(),
    })
  ),
});

export async function PUT(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken !== process.env.ADMIN_SECRET) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const now = new Date().toISOString();

    for (const r of parsed.data.routes) {
      const routeData: Record<string, unknown> = {};
      if (r.base_fare !== undefined) routeData.base_fare = r.base_fare;
      if (r.is_active !== undefined) routeData.is_active = r.is_active;

      if (Object.keys(routeData).length > 0) {
        const { error } = await db.from("RouteConfig").update(routeData).eq("id", r.id);
        if (error) throw error;
      }

      if (r.fare_rule) {
        const { error } = await db.from("FareRule").upsert({
          id:             crypto.randomUUID(),
          route_id:       r.id,
          discount_pct:   r.fare_rule.discount_pct   ?? 0,
          discount_on:    r.fare_rule.discount_on    ?? false,
          discount_label: r.fare_rule.discount_label ?? null,
          global_offer:   r.fare_rule.global_offer   ?? false,
          updated_at:     now,
        }, { onConflict: "route_id" });
        if (error) throw error;
      }
    }

    try {
      await db.from("AdminLog").insert({
        admin_id: "admin", action: "fares_updated", entity: "fare",
        entity_id: "batch", details: { routes: parsed.data.routes },
      });
    } catch {}

    return Response.json({ data: { updated: parsed.data.routes.length }, error: null });
  } catch (err) {
    console.error("[fares PUT]", err);
    return Response.json({ data: null, error: "Failed to update fares" }, { status: 500 });
  }
}
