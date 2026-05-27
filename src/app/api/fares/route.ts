import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const routes = await prisma.routeConfig.findMany({
      include: { fare_rule: true },
      orderBy: [{ from_city: "asc" }, { to_city: "asc" }],
    });
    return Response.json({ data: routes, error: null });
  } catch (err) {
    console.error("[fares GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch fares" },
      { status: 500 }
    );
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
  // Admin only — check via header or session (simplified for MVP)
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken !== process.env.ADMIN_SECRET) {
    return Response.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const updates = await prisma.$transaction(
      parsed.data.routes.map((r) =>
        prisma.routeConfig.update({
          where: { id: r.id },
          data: {
            ...(r.base_fare !== undefined ? { base_fare: r.base_fare } : {}),
            ...(r.is_active !== undefined ? { is_active: r.is_active } : {}),
            ...(r.fare_rule
              ? {
                  fare_rule: {
                    upsert: {
                      create: {
                        discount_pct:   r.fare_rule.discount_pct   ?? 0,
                        discount_on:    r.fare_rule.discount_on    ?? false,
                        discount_label: r.fare_rule.discount_label ?? null,
                        global_offer:   r.fare_rule.global_offer   ?? false,
                      },
                      update: {
                        ...(r.fare_rule.discount_pct   !== undefined ? { discount_pct: r.fare_rule.discount_pct } : {}),
                        ...(r.fare_rule.discount_on    !== undefined ? { discount_on:  r.fare_rule.discount_on  } : {}),
                        ...(r.fare_rule.discount_label !== undefined ? { discount_label: r.fare_rule.discount_label } : {}),
                        ...(r.fare_rule.global_offer   !== undefined ? { global_offer: r.fare_rule.global_offer } : {}),
                      },
                    },
                  },
                }
              : {}),
          },
        })
      )
    );

    try {
      const db = getAdminClient();
      await db.from("AdminLog").insert({
        admin_id:  "admin",
        action:    "fares_updated",
        entity:    "fare",
        entity_id: "batch",
        details:   { routes: parsed.data.routes },
      });
    } catch {}

    return Response.json({ data: { updated: updates.length }, error: null });
  } catch (err) {
    console.error("[fares PUT]", err);
    return Response.json(
      { data: null, error: "Failed to update fares" },
      { status: 500 }
    );
  }
}
