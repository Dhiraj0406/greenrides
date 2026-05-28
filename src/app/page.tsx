export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";
import { STATIC_ROUTES } from "@/data/static-routes";
import { LocationDetector } from "@/components/booking/LocationDetector";
import { CityPicker } from "@/components/booking/CityPicker";
import { DayTrips } from "@/components/booking/DayTrips";
import { FareCard } from "@/components/booking/FareCard";
import { CustomRouteBox } from "@/components/booking/CustomRouteBox";
import { BottomNav } from "@/components/shared/BottomNav";
import Link from "next/link";
import { getFlag } from "@/modules/platform/db";
import { Leaf, Phone, Star, MapPin, Shield, Car } from "lucide-react";
import type { RouteInfo } from "@/types";

async function getAllRoutes(): Promise<RouteInfo[]> {
  try {
    const routes = await prisma.routeConfig.findMany({
      where:   { is_active: true },
      include: { fare_rule: true },
      orderBy: { distance_km: "asc" },
    });
    if (!(routes as unknown[]).length) return STATIC_ROUTES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (routes as any[]).map((r) => ({
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
  } catch {
    return STATIC_ROUTES;
  }
}

async function getDemandRoutes(): Promise<Array<{ from_city: string; to_city: string; count: number }>> {
  try {
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await getAdminClient()
      .from("RideRequest")
      .select("from_city, to_city")
      .eq("status", "PENDING")
      .lte("travel_date", sevenDaysOut)
      .gte("travel_date", new Date().toISOString());

    if (!data || data.length === 0) return [];

    const counts: Record<string, { from_city: string; to_city: string; count: number }> = {};
    for (const r of data) {
      const key = `${r.from_city}|${r.to_city}`;
      if (!counts[key]) counts[key] = { from_city: r.from_city, to_city: r.to_city, count: 0 };
      counts[key].count++;
    }

    return Object.values(counts).filter(r => r.count >= 2).sort((a, b) => b.count - a.count).slice(0, 3);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [allRoutes, demandRoutes, usedCarsEnabled] = await Promise.all([
    getAllRoutes(),
    getDemandRoutes(),
    getFlag("used_cars.module_enabled", false),
  ]);

  return (
    <div className="green-container min-h-screen bg-cream pb-24">

      {/* ── Header + Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden"
           style={{ background: "linear-gradient(160deg, #051a0e 0%, #0d2818 40%, #1a3d25 100%)" }}>

        {/* Top nav */}
        <header className="px-4 pt-safe-top">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-leaf flex items-center justify-center flex-shrink-0
                              shadow-lg shadow-leaf/30">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-display text-xl text-lime tracking-tight leading-none">Green</span>
                <p className="text-lime/50 text-[10px] leading-tight mt-0.5 tracking-wide">The peaceful ride</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1 border border-white/10">
              <Star className="w-3 h-3 text-gold fill-gold" />
              <span className="text-white/80 text-xs font-semibold">4.8</span>
            </div>
          </div>
        </header>

        {/* Hero text */}
        <div className="px-5 pt-2 pb-6 animate-fade-in-up">
          <p className="text-lime/60 text-xs font-semibold uppercase tracking-widest mb-2">
            Odisha Hill Routes · Private Cab
          </p>
          <h1 className="font-display text-white text-[1.85rem] leading-tight mb-4">
            Your hills,<br/>
            <span className="text-lime">your ride, your pace.</span>
          </h1>

          {/* Stats strip */}
          <div className="flex gap-2.5">
            <div className="glass-card rounded-2xl px-3.5 py-2.5 flex-1 text-center animate-fade-in-up delay-100">
              <p className="font-display text-xl text-lime leading-none">₹500</p>
              <p className="text-white/40 text-[10px] mt-0.5">starting fare</p>
            </div>
            <div className="glass-card rounded-2xl px-3.5 py-2.5 flex-1 text-center animate-fade-in-up delay-200">
              <p className="font-display text-xl text-lime leading-none">8+</p>
              <p className="text-white/40 text-[10px] mt-0.5">cities covered</p>
            </div>
            <div className="glass-card rounded-2xl px-3.5 py-2.5 flex-1 text-center animate-fade-in-up delay-300">
              <p className="font-display text-xl text-lime leading-none">24/7</p>
              <p className="text-white/40 text-[10px] mt-0.5">availability</p>
            </div>
          </div>
        </div>

        {/* Mountain silhouette */}
        <svg className="w-full block -mb-px" viewBox="0 0 480 56" preserveAspectRatio="none"
             style={{ height: 56 }}>
          <path d="M0 56V38L55 18L100 32L155 8L200 26L245 4L285 22L330 10L370 28L415 14L450 26L480 18V56H0Z"
                fill="#1a3d25" opacity="0.5"/>
          <path d="M0 56V44L40 28L85 40L130 22L175 36L215 16L255 34L300 20L340 38L380 24L425 35L465 22L480 30V56H0Z"
                fill="#f8f6f2"/>
        </svg>
      </div>

      {/* Trust badges */}
      <div className="flex gap-3 px-4 pt-4 pb-2 animate-fade-in">
        {[
          { icon: Shield, label: "Verified drivers" },
          { icon: MapPin, label: "GPS tracked" },
          { icon: Phone, label: "24/7 support" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 flex-1 bg-white rounded-xl px-2.5 py-2
                                      border border-border shadow-sm">
            <Icon className="w-3 h-3 text-leaf flex-shrink-0" />
            <span className="text-[10px] font-semibold text-sub leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {demandRoutes.length > 0 && (
        <div className="px-4 pt-2 pb-1">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-amber-700 mb-2">🔥 High demand routes</p>
            <div className="flex flex-wrap gap-2">
              {demandRoutes.map((r) => (
                <span key={`${r.from_city}-${r.to_city}`} className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
                  {r.from_city} → {r.to_city} · {r.count} requests
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Silently detect location → sets origin in store */}
      <LocationDetector />

      {/* City buttons + destination grid */}
      <CityPicker initialRoutes={allRoutes} />

      {/* Fare card (appears when destination is selected) */}
      <FareCard />

      {/* Tourist day trips */}
      <DayTrips />

      {/* AI custom route estimator */}
      <CustomRouteBox />

      {/* Used Cars banner (flag-gated) */}
      {usedCarsEnabled && (
        <div className="px-4 mt-4">
          <p className="text-xs font-semibold text-sub uppercase tracking-wider mb-2">More Services</p>
          <Link href="/used-cars"
            className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-leaf/10 flex items-center justify-center">
                <Car className="w-4 h-4 text-leaf" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Used Cars</p>
                <p className="text-xs text-sub">Buy or sell a car in Odisha</p>
              </div>
            </div>
            <span className="text-sub text-sm">→</span>
          </Link>
        </div>
      )}

      {/* Sticky call-to-book bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="green-container">
          <a
            href="tel:+919668021577"
            className="pointer-events-auto flex items-center justify-center gap-2
                       bg-forest border border-leaf/40 text-white text-sm font-semibold
                       py-3.5 rounded-2xl shadow-xl shadow-forest/40
                       animate-pulse-glow"
          >
            <Phone className="w-4 h-4 text-lime" />
            Call to book: +91 96680 21577
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
