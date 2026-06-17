import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { getRouteData, calculateFareFromDistance } from "@/lib/maps";

const schema = z.object({
  from: z.string().min(2),
  to:   z.string().min(2),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    from: searchParams.get("from"),
    to:   searchParams.get("to"),
  });

  if (!parsed.success) {
    return Response.json(
      { data: null, error: "from and to are required" },
      { status: 400 }
    );
  }

  const { from, to } = parsed.data;

  // Try cache from RouteConfig first
  try {
    const db = getAdminClient();
    const { data: cached } = await db
      .from("RouteConfig")
      .select("*, FareRule!route_id(discount_pct, discount_on, discount_label)")
      .eq("from_city", from)
      .eq("to_city", to)
      .maybeSingle();

    if (cached && cached.is_active) {
      const fareRule = (cached.FareRule as Array<{ discount_pct: number; discount_on: boolean; discount_label: string | null }> ?? [])[0];
      const discountPct = fareRule?.discount_on ? (fareRule.discount_pct ?? 0) : 0;
      const discountedFare = Math.round(
        (cached.base_fare * (1 - discountPct / 100)) / 100
      );

      return Response.json({
        data: {
          from_city:      from,
          to_city:        to,
          distance_km:    cached.distance_km,
          duration_min:   cached.duration_min,
          duration_text:  `${Math.floor(cached.duration_min / 60)}h ${cached.duration_min % 60}m`,
          fare_paise:     cached.base_fare,
          fare_rupees:    discountedFare,
          discount_pct:   discountPct,
          discount_label: fareRule?.discount_label ?? null,
          source:         "cache",
        },
        error: null,
      });
    }
  } catch {
    // DB unavailable — fall through to Google Maps
  }

  // Fall back to Google Maps
  try {
    const route = await getRouteData(from, to);
    const fare  = calculateFareFromDistance(route.distance_km);

    return Response.json({
      data: {
        from_city:      from,
        to_city:        to,
        distance_km:    route.distance_km,
        duration_min:   route.duration_min,
        duration_text:  route.duration_text,
        fare_paise:     fare * 100,
        fare_rupees:    fare,
        discount_pct:   0,
        discount_label: null,
        source:         "maps",
      },
      error: null,
    });
  } catch (err) {
    console.error("[geo/distance]", err);
    return Response.json(
      { data: null, error: "Could not calculate route" },
      { status: 500 }
    );
  }
}
