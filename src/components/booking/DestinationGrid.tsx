"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration, cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";
import type { RouteInfo } from "@/types";

interface Props {
  initialRoutes?: RouteInfo[];
}

export function DestinationGrid({ initialRoutes }: Props) {
  const { origin, destination, setDestination, setRouteData } = useBookingStore();
  const [routes, setRoutes] = useState<RouteInfo[]>(initialRoutes ?? []);
  const [loading, setLoading] = useState(!initialRoutes);

  useEffect(() => {
    if (!origin || initialRoutes) return;
    setLoading(true);

    // Fetch routes from the distance API
    const knownDestinations =
      origin === "Koraput"
        ? ["Jeypore", "Sunabeda", "Boipariguda", "Kundra", "Narayanpatna",
           "Malkangiri", "Rayagada", "Jagdalpur"]
        : ["Koraput", "Sunabeda", "Boipariguda", "Kundra", "Narayanpatna",
           "Malkangiri", "Rayagada", "Jagdalpur"];

    Promise.allSettled(
      knownDestinations.map((to) =>
        fetch(`/api/geo/distance?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(to)}`)
          .then((r) => r.json())
          .then((j) => j.data as RouteInfo)
      )
    ).then((results) => {
      const valid = results
        .filter((r): r is PromiseFulfilledResult<RouteInfo> => r.status === "fulfilled" && !!r.value)
        .map((r) => r.value);
      setRoutes(valid);
      setLoading(false);
    });
  }, [origin, initialRoutes]);

  if (!origin) return null;

  if (loading) {
    return (
      <section className="px-4 mt-6">
        <h2 className="text-base font-semibold text-text mb-3">Choose your destination</h2>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 mt-6">
      <h2 className="text-base font-semibold text-text mb-3">
        From {origin}, go to…
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {routes.map((route) => {
          const active     = destination === route.to_city;
          const discounted = route.discount_pct && route.discount_pct > 0;

          return (
            <button
              key={route.to_city}
              onClick={() => {
                setDestination(route.to_city);
                setRouteData({
                  km:   route.distance_km,
                  min:  route.duration_min,
                  text: route.duration_text,
                  fare: route.fare_rupees,
                });
                track.destinationSelected(origin, route.to_city, route.fare_rupees);
              }}
              className={cn(
                "flex flex-col items-start p-4 rounded-2xl border touch-target",
                "transition-all duration-200 text-left",
                active
                  ? "bg-forest border-leaf"
                  : "bg-white border-border hover:border-leaf/40"
              )}
            >
              {discounted && (
                <span className="text-[10px] font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-full mb-1.5">
                  {route.discount_pct}% OFF
                </span>
              )}
              <span className={cn("font-semibold text-sm", active ? "text-lime" : "text-text")}>
                {route.to_city}
              </span>
              <div className={cn("flex items-center gap-1 mt-1", active ? "text-lime/70" : "text-sub")}>
                <MapPin className="w-3 h-3" />
                <span className="text-xs font-mono-green">{route.distance_km}km</span>
                <span className="text-xs">·</span>
                <Clock className="w-3 h-3" />
                <span className="text-xs font-mono-green">{formatDuration(route.duration_min)}</span>
              </div>
              <span
                className={cn(
                  "mt-2 font-display text-xl font-bold",
                  active ? "text-white" : "text-forest"
                )}
              >
                ₹{route.fare_rupees}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
