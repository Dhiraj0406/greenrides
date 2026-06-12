"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration, cn } from "@/lib/utils";
import type { RouteInfo } from "@/types";

const CITIES = [
  "Koraput",
  "Jeypore",
  "Sunabeda",
  "Rayagada",
  "Nabarangpur",
  "Malkangiri",
  "Jagdalpur",
  "Visakhapatnam",
];

interface Props {
  initialRoutes: RouteInfo[];
}

export function CityPicker({ initialRoutes }: Props) {
  const { origin, destination, setOrigin, setDestination, setRouteData, setDiscount } =
    useBookingStore();

  // allRoutes always accumulates — never replaced, only appended
  const [allRoutes, setAllRoutes] = useState<RouteInfo[]>(initialRoutes);
  const [loadingCity, setLoadingCity] = useState<string | null>(null);
  const loadedCities = useRef<Set<string>>(
    new Set(initialRoutes.map((r) => r.from_city))
  );

  // When origin changes to a city not yet in allRoutes, fetch and append
  useEffect(() => {
    if (!origin) return;
    if (loadedCities.current.has(origin)) return;

    let cancelled = false;
    setLoadingCity(origin);
    fetch(`/api/routes?origin=${encodeURIComponent(origin)}`)
      .then((r) => r.json())
      .then((j: { data?: RouteInfo[] }) => {
        if (!cancelled && j.data?.length) {
          loadedCities.current.add(origin);
          setAllRoutes((prev) => [...prev, ...j.data!]);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingCity(null); });

    return () => { cancelled = true; };
  }, [origin]);

  function selectCity(city: string) {
    if (city !== origin) setOrigin(city);
  }

  function selectRoute(route: RouteInfo) {
    setDestination(route.to_city);
    setRouteData({
      km:   route.distance_km,
      min:  route.duration_min,
      text: route.duration_text,
      fare: route.fare_rupees,
    });
    setDiscount(route.discount_pct ?? 0, route.discount_label ?? "");
    track.destinationSelected(origin ?? route.from_city, route.to_city, route.fare_rupees);
    setTimeout(() => {
      document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  const activeCity = origin ?? "Koraput";
  const displayRoutes = allRoutes.filter((r) => r.from_city === activeCity);

  return (
    <section className="mt-5">
      {/* ── City button strip ─────────────────────────────── */}
      <div className="px-4 mb-1">
        <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">
          From where?
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {CITIES.map((city) => {
          const active = city === activeCity;
          return (
            <button
              key={city}
              onClick={() => selectCity(city)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold",
                "border transition-all duration-150 touch-target",
                active
                  ? "bg-forest border-leaf text-lime shadow-sm"
                  : "bg-white border-border text-text hover:border-leaf/40"
              )}
            >
              {city}
            </button>
          );
        })}
      </div>

      {/* ── Destination grid ──────────────────────────────── */}
      <div className="px-4 mt-5">
        <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">
          {loadingCity ? `Loading routes from ${loadingCity}…` : `Go to from ${activeCity}`}
        </p>

        {loadingCity ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-warm rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : displayRoutes.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {displayRoutes.map((route) => {
              const active = destination === route.to_city;
              return (
                <button
                  key={route.to_city}
                  onClick={() => selectRoute(route)}
                  style={{ boxShadow: "var(--sh-sm)" }}
                  className={cn(
                    "flex flex-col items-start p-3.5 rounded-2xl border text-left",
                    "transition-all duration-150 touch-target min-w-[140px]",
                    active
                      ? "bg-forest border-leaf shadow-lg"
                      : "bg-white border-border hover:border-leaf/40 hover:shadow-sm"
                  )}
                >
                  <MapPin className={cn("w-4 h-4 mb-2", active ? "text-lime" : "text-leaf")} />
                  <span className={cn(
                    "font-semibold text-sm leading-tight",
                    active ? "text-white" : "text-text"
                  )}>
                    {route.to_city}
                  </span>
                  <span className={cn(
                    "text-xs mt-1 font-mono-green",
                    active ? "text-lime/70" : "text-sub"
                  )}>
                    {route.distance_km} km
                  </span>
                  <span className={cn(
                    "flex items-center gap-1 text-xs mt-0.5",
                    active ? "text-lime/80" : "text-forest font-semibold"
                  )}>
                    ₹{route.fare_rupees.toLocaleString("en-IN")}
                  </span>
                  {active && (
                    <div className="flex items-center gap-1 mt-2 text-lime/70 text-[10px]">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(route.duration_min)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-sub">No routes from {activeCity} yet</p>
            <p className="text-xs text-sub/60 mt-1">Try the custom estimator below</p>
          </div>
        )}

        {/* View fare detail CTA when destination selected */}
        {destination && (
          <button
            onClick={() =>
              document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="mt-3 w-full flex items-center justify-between px-4 py-3
                       bg-forest rounded-2xl border border-leaf/30 text-white text-sm font-semibold"
          >
            <span>View fare to {destination}</span>
            <ChevronRight className="w-4 h-4 text-lime" />
          </button>
        )}
      </div>
    </section>
  );
}
