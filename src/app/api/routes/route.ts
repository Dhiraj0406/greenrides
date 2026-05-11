import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");

  try {
    const where = origin
      ? { from_city: origin, is_active: true }
      : { is_active: true };

    const routes = await prisma.routeConfig.findMany({
      where,
      include: { fare_rule: true },
      orderBy: { distance_km: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (routes as any[]).map((r) => ({
      from_city:      r.from_city,
      to_city:        r.to_city,
      distance_km:    r.distance_km,
      duration_min:   r.duration_min,
      duration_text:  `${Math.floor(r.duration_min / 60)}h ${r.duration_min % 60}m`,
      fare_paise:     r.base_fare,
      fare_rupees:    Math.round(r.base_fare / 100),
      discount_pct:   r.fare_rule?.discount_pct ?? 0,
      discount_label: r.fare_rule?.discount_label ?? null,
    }));

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[routes GET]", err);
    return Response.json({ data: null, error: "Failed to fetch routes" }, { status: 500 });
  }
}
