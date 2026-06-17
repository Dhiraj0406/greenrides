"use client";

import { useState, useEffect } from "react";
import { ArrowRight, MapPin, Clock, ChevronRight } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { BookingConfirmSheet } from "@/components/booking/BookingConfirmSheet";
import { FindingDriverSheet } from "@/components/booking/FindingDriverSheet";

export function FareCard() {
  const {
    origin, destination, distanceKm, durationMin, durationText,
    fareRupees, discountPct, discountLabel,
  } = useBookingStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [activeBooking, setActiveBooking] = useState<{ requestId: string; from: string; to: string; fare: number } | null>(null);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "");
      setUserPhone(user.user_metadata?.phone || user.phone || "");
    });
  }, []);

  if (!origin || !destination || fareRupees === null) return null;

  const today   = new Date();
  const rawDate = today.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = today.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const durStr  = durationText ?? (durationMin ? formatDuration(durationMin) : "");

  return (
    <>
      <section id="fare-card" className="px-4 mt-6">
        <div className="bg-forest p-5 text-white" style={{ borderRadius: "var(--r-lg)" }}>
          <div className="flex items-center gap-2 text-sm text-lime/80 mb-3">
            <span>{origin}</span>
            <ArrowRight className="w-3.5 h-3.5" />
            <span>{destination}</span>
          </div>

          <div className="flex items-end gap-2 mb-1">
            <span className="font-display font-bold text-white leading-none" style={{ fontSize: "2rem" }}>
              ₹{fareRupees?.toLocaleString("en-IN")}
            </span>
            {discountPct > 0 && (
              <span className="text-gold text-sm font-semibold mb-1">{discountPct}% OFF</span>
            )}
          </div>
          <p className="text-lime/60 text-xs font-semibold mb-1 uppercase tracking-wide">
            Entire cab · Private hire
          </p>
          {discountLabel && <p className="text-gold/80 text-xs mb-3">{discountLabel}</p>}

          <div className="flex items-center gap-4 text-lime/60 text-sm mt-2 mb-4">
            {distanceKm && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {distanceKm} km
              </span>
            )}
            {durationMin && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {durationText ?? formatDuration(durationMin)}
              </span>
            )}
          </div>

          <button
            onClick={() => { track.fareConfirmed(origin!, destination!, fareRupees!); setShowConfirm(true); }}
            className="w-full flex items-center justify-center gap-2 bg-leaf hover:bg-leaf/90 text-white font-semibold py-4 rounded-xl touch-target transition-colors text-base"
          >
            Book · ₹{fareRupees?.toLocaleString("en-IN")} →
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {showConfirm && (
        <BookingConfirmSheet
          booking={{
            from:    origin,
            to:      destination,
            rawDate,
            date:    dateStr,
            time:    timeStr,
            fare:    fareRupees,
            km:      distanceKm ?? 0,
            dur:     durStr,
            name:    userName,
            phone:   userPhone,
          }}
          onConfirm={(requestId) => { setShowConfirm(false); setActiveBooking({ requestId, from: origin!, to: destination!, fare: fareRupees! }); }}
          onClose={() => setShowConfirm(false)}
        />
      )}
      {activeBooking && (
        <FindingDriverSheet
          requestId={activeBooking.requestId}
          from={activeBooking.from}
          to={activeBooking.to}
          fare={activeBooking.fare}
          onDone={() => setActiveBooking(null)}
        />
      )}
    </>
  );
}
