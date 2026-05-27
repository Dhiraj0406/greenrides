import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { STATIC_ROUTES } from "@/data/static-routes";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");

  try {
    const db = getAdminClient();
    let query = db
      .from("RouteConfig")
      .select("from_city, to_city, distance_km, duration_min, base_fare, FareRule(discount_pct, discount_label)")
      .eq("is_active", true)
      .order("distance_km", { ascending: true });

    if (origin) {
      query = query.eq("from_city", origin) as typeof query;
    }

    const { data: routes, error } = await query;

    if (error || !routes?.length) {
      const staticData = origin
        ? STATIC_ROUTES.filter((r) => r.from_city === origin)
        : STATIC_ROUTES;
      return Response.json({ data: staticData, error: null });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (routes as any[]).map((r) => {
      const fareRule = Array.isArray(r.FareRule) ? r.FareRule[0] : r.FareRule;
      return {
        from_city:      r.from_city,
        to_city:        r.to_city,
        distance_km:    r.distance_km,
        duration_min:   r.duration_min,
        duration_text:  `${Math.floor(r.duration_min / 60)}h ${r.duration_min % 60}m`,
        fare_paise:     r.base_fare,
        fare_rupees:    Math.round(r.base_fare / 100),
        discount_pct:   fareRule?.discount_pct ?? 0,
        discount_label: fareRule?.discount_label ?? null,
      };
    });

    return Response.json({ data, error: null });
  } catch {
    const staticData = origin
      ? STATIC_ROUTES.filter((r) => r.from_city === origin)
      : STATIC_ROUTES;
    return Response.json({ data: staticData, error: null });
  }
}
