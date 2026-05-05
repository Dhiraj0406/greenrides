"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Star, Clock, Users, Loader2, AlertCircle } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";
import { useBookingStore } from "@/store/booking";
import { todayISO } from "@/lib/utils";
import type { RideWithDriver } from "@/types";

export default function RidesPage() {
  const { origin, destination } = useBookingStore();
  const [rides, setRides]       = useState<RideWithDriver[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!origin) { setLoading(false); return; }
    const to   = destination ?? "";
    const url  = `/api/rides?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(to)}&date=${todayISO()}`;

    fetch(url)
      .then((r) => r.json())
      .then((j) => setRides(j.data ?? []))
      .finally(() => setLoading(false));
  }, [origin, destination]);

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-5">
        <div className="pt-4">
          <h1 className="font-display text-2xl text-white">Available Rides</h1>
          {origin && (
            <div className="flex items-center gap-2 text-lime/70 text-sm mt-1">
              <span>{origin}</span>
              {destination && (
                <>
                  <ArrowRight className="w-3 h-3" />
                  <span>{destination}</span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="px-4 mt-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        {!loading && !rides.length && (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-sub mb-3" />
            <p className="font-semibold text-text">No rides today</p>
            <p className="text-sm text-sub mt-1">
              {origin
                ? `No drivers have posted rides from ${origin} today.`
                : "Select your origin on the home screen first."}
            </p>
          </div>
        )}

        {!loading && rides.map((ride) => (
          <div
            key={ride.id}
            className="bg-white border border-border rounded-2xl p-4 mb-3"
          >
            {/* Driver row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-forest-mid flex items-center
                              justify-center text-lime font-display flex-shrink-0">
                {ride.driver.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-text text-sm">{ride.driver.name}</p>
                <p className="text-xs text-sub">
                  {ride.driver.vehicle_model} · {ride.driver.vehicle_number}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-gold text-gold" />
                <span className="text-sm font-semibold text-gold">
                  {ride.driver.avg_rating.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Route row */}
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="font-semibold text-text">{ride.from_city}</span>
              <ArrowRight className="w-3.5 h-3.5 text-sub" />
              <span className="font-semibold text-text">{ride.to_city}</span>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-sub font-mono-green mb-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(ride.departure_time).toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {ride.available_seats} seats left
              </span>
            </div>

            {/* Fare + book */}
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl text-forest">
                ₹{Math.round(ride.fare_paise / 100)}
              </span>
              <button
                className="bg-leaf text-white text-sm font-semibold
                           px-5 py-2.5 rounded-xl touch-target transition-colors
                           hover:bg-leaf/90"
              >
                Book
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
