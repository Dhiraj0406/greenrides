import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { LocationDetector } from "@/components/booking/LocationDetector";
import { OriginPicker } from "@/components/booking/OriginPicker";
import { DestinationGrid } from "@/components/booking/DestinationGrid";
import { FareCard } from "@/components/booking/FareCard";
import { CustomRouteBox } from "@/components/booking/CustomRouteBox";
import { TouristPlaces } from "@/components/booking/TouristPlaces";
import { BottomNav } from "@/components/shared/BottomNav";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";
import { Leaf } from "lucide-react";
import type { RouteInfo } from "@/types";

async function getInitialRoutes(): Promise<RouteInfo[]> {
  try {
    const routes = await prisma.routeConfig.findMany({
      where:   { from_city: "Koraput", is_active: true },
      include: { fare_rule: true },
      orderBy: { distance_km: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (routes as any[]).map((r) => ({
      from_city:     r.from_city,
      to_city:       r.to_city,
      distance_km:   r.distance_km,
      duration_min:  r.duration_min,
      duration_text: `${Math.floor(r.duration_min / 60)}h ${r.duration_min % 60}m`,
      fare_paise:    r.base_fare,
      fare_rupees:   Math.round(r.base_fare / 100),
      discount_pct:  r.fare_rule?.discount_pct ?? 0,
      discount_label: r.fare_rule?.discount_label ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const initialRoutes = await getInitialRoutes();

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      {/* Header */}
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-leaf flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-xl text-lime tracking-tight">
              Green
            </span>
          </div>
          <span className="text-xs text-lime/60 font-mono-green">
            Odisha Hill Routes
          </span>
        </div>

        <div className="mt-5">
          <h1 className="font-display text-3xl text-white leading-tight">
            Where are you<br />
            headed today?
          </h1>
          <p className="text-sm text-lime/70 mt-1">
            Jeypore · Koraput · all hill towns
          </p>
        </div>
      </header>

      {/* Location auto-detect */}
      <LocationDetector />

      {/* Origin picker */}
      <div className="mt-6">
        <OriginPicker />
      </div>

      {/* Destination grid — server-prefetched for Koraput, lazy for others */}
      <Suspense
        fallback={
          <section className="px-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </section>
        }
      >
        <DestinationGrid initialRoutes={initialRoutes} />
      </Suspense>

      {/* Fare + driver CTA (shows when destination selected) */}
      <FareCard />

      {/* Custom route AI estimator */}
      <CustomRouteBox />

      {/* Tourist places */}
      <TouristPlaces />

      <BottomNav />
    </div>
  );
}
