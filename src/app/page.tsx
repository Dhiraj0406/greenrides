export const dynamic = "force-dynamic";

import { getAdminClient } from "@/lib/supabase";
import { STATIC_ROUTES } from "@/data/static-routes";
import { LocationDetector } from "@/components/booking/LocationDetector";
import { CustomRouteBox } from "@/components/booking/CustomRouteBox";
import { HomeContent } from "@/components/booking/HomeContent";
import { AppBar } from "@/components/shared/AppBar";
import { BottomNav } from "@/components/shared/BottomNav";
import { Phone } from "lucide-react";
import type { RouteInfo } from "@/types";

async function getAllRoutes(): Promise<RouteInfo[]> {
  try {
    const { data: routes, error } = await getAdminClient()
      .from("RouteConfig")
      .select("from_city, to_city, distance_km, duration_min, base_fare, FareRule(discount_pct, discount_label)")
      .eq("is_active", true)
      .order("distance_km", { ascending: true });

    if (error || !routes?.length) return STATIC_ROUTES;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (routes as any[]).map((r) => {
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
  } catch {
    return STATIC_ROUTES;
  }
}

export default async function HomePage() {
  const allRoutes = await getAllRoutes();

  return (
    <div
      className="green-container min-h-screen pb-24"
      style={{ background: "var(--paper-2)" }}
    >
      <AppBar />

      <div style={{ overflowY: "auto", overscrollBehavior: "contain", paddingBottom: 16 }}>
        <LocationDetector />
        <HomeContent initialRoutes={allRoutes} />

        <div style={{ marginTop: 8 }}>
          <CustomRouteBox />
        </div>

        <div style={{ height: 20 }} />
      </div>

      {/* Sticky call-to-book bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="green-container">
          <a
            href="tel:+919668021577"
            className="pointer-events-auto flex items-center justify-center gap-2
                       text-white text-sm font-semibold py-3.5 rounded-2xl"
            style={{ background: "var(--green)", boxShadow: "0 8px 24px rgba(26,61,36,.35)" }}
          >
            <Phone className="w-4 h-4" />
            Call to book: +91 96680 21577
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
