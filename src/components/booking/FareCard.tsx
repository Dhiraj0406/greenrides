"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Clock, ChevronRight } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration } from "@/lib/utils";
import { DriverSheet } from "./DriverSheet";

export function FareCard() {
  const {
    origin, destination, distanceKm, durationMin, durationText,
    fareRupees, discountPct, discountLabel,
  } = useBookingStore();
  const [showDriver, setShowDriver] = useState(false);

  if (!origin || !destination || fareRupees === null) return null;

  function handleConfirm() {
    track.fareConfirmed(origin!, destination!, fareRupees!);
    setShowDriver(true);
  }

  return (
    <>
      <section className="px-4 mt-6">
        <div className="bg-forest rounded-2xl p-5 text-white">
          {/* Route header */}
          <div className="flex items-center gap-2 text-sm text-lime/80 mb-3">
            <span>{origin}</span>
            <ArrowRight className="w-3.5 h-3.5" />
            <span>{destination}</span>
          </div>

          {/* Fare */}
          <div className="flex items-end gap-2 mb-1">
            <span className="font-display text-5xl font-bold text-white leading-none">
              ₹{fareRupees}
            </span>
            {discountPct > 0 && (
              <span className="text-gold text-sm font-semibold mb-1">
                {discountPct}% OFF
              </span>
            )}
          </div>
          {discountLabel && (
            <p className="text-gold/80 text-xs mb-3">{discountLabel}</p>
          )}

          {/* Distance + duration */}
          <div className="flex items-center gap-4 text-lime/60 text-sm mt-2 mb-4">
            {distanceKm && (
              <span className="flex items-center gap-1 font-mono-green">
                <MapPin className="w-3.5 h-3.5" />
                {distanceKm} km
              </span>
            )}
            {durationMin && (
              <span className="flex items-center gap-1 font-mono-green">
                <Clock className="w-3.5 h-3.5" />
                {durationText ?? formatDuration(durationMin)}
              </span>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleConfirm}
            className="w-full flex items-center justify-center gap-2 bg-leaf hover:bg-leaf/90
                       text-white font-semibold py-4 rounded-xl touch-target
                       transition-colors text-base"
          >
            Confirm &amp; See Driver
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <DriverSheet
        open={showDriver}
        onClose={() => setShowDriver(false)}
        from={origin}
        to={destination}
        fareRupees={fareRupees}
      />
    </>
  );
}
