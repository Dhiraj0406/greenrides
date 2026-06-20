"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Star, Clock, AlertCircle, Phone, Calendar } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BottomNav } from "@/components/shared/BottomNav";
import { DriverSheet } from "@/components/booking/DriverSheet";
import { useBookingStore } from "@/store/booking";
import { todayISO } from "@/lib/utils";
import type { RideWithDriver } from "@/types";

const MAX_CIRCLES = 8;

function SeatPills({ totalSeats, availableSeats }: { totalSeats: number; availableSeats: number }) {
  const bookedSeats = totalSeats - availableSeats;
  const display     = Math.min(totalSeats, MAX_CIRCLES);
  // Scale booked count proportionally if capped
  const bookedDisplay = Math.min(bookedSeats, display);

  return (
    <div>
      <div className="flex items-center gap-1">
        {Array.from({ length: display }).map((_, i) => (
          i < bookedDisplay ? (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-sub inline-block"
            />
          ) : (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full border border-leaf inline-block"
            />
          )
        ))}
      </div>
      <p className="text-xs text-sub mt-1">
        {availableSeats} seat{availableSeats !== 1 ? "s" : ""} left
      </p>
    </div>
  );
}

export default function RidesPage() {
  const { origin, destination } = useBookingStore();
  const [rides, setRides]       = useState<RideWithDriver[]>([]);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(todayISO());
  const [bookingRide, setBookingRide] = useState<RideWithDriver | null>(null);

  useEffect(() => {
    if (!origin) { setLoading(false); return; }
    const to  = destination ?? "";
    const url = `/api/rides?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(to)}&date=${date}`;

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((j) => setRides(j.data ?? []))
      .catch(() => { toast.error("Failed to load rides"); setRides([]); })
      .finally(() => setLoading(false));
  }, [origin, destination, date]);

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-5">
        <div className="pt-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href="/" className="mt-1 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </Link>
            <div>
              <h1 className="font-display text-2xl text-white">Available Cabs</h1>
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
          </div>
          <label className="flex items-center gap-1.5 bg-forest-mid rounded-xl px-3 py-2 cursor-pointer flex-shrink-0">
            <Calendar className="w-4 h-4 text-lime/70" />
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="bg-transparent text-lime text-xs font-semibold outline-none w-28"
            />
          </label>
        </div>
      </header>

      <div className="px-4 mt-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-amber-700 mb-1.5">Two ways to book</p>
          <div className="space-y-1.5 text-xs text-amber-700">
            <p>🚗 <strong>Cab seat</strong> — Choose from rides posted below. Pay cash to driver, instant confirmation.</p>
            <p>📋 <strong>Private request</strong> — Request a full cab for your date. We find you a driver (can take a few minutes).</p>
          </div>
        </div>

        {loading && (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-border rounded-2xl p-4 mb-3">
                {/* Driver row skeleton */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-border flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="bg-border rounded-full h-3.5 w-28" />
                    <div className="bg-border rounded-full h-3 w-40" />
                  </div>
                  <div className="bg-border rounded-full h-4 w-10" />
                </div>
                {/* Route row skeleton */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-border rounded-full h-3.5 w-20" />
                  <div className="bg-border rounded-full h-3 w-4" />
                  <div className="bg-border rounded-full h-3.5 w-20" />
                </div>
                {/* Meta row skeleton */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="bg-border rounded-full h-3 w-14" />
                  <div className="bg-border rounded-full h-3 w-16" />
                </div>
                {/* Fare + book skeleton */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="bg-border rounded-full h-6 w-16" />
                    <div className="bg-border rounded-full h-3 w-12" />
                  </div>
                  <div className="bg-border rounded-xl h-10 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !rides.length && (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-sub mb-3" />
            <p className="font-semibold text-text">No cabs on this date</p>
            <p className="text-sm text-sub mt-1">
              {origin
                ? `No drivers have posted cabs from ${origin} on ${new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`
                : "Select your origin on the home screen first."}
            </p>
            <a
              href="tel:+919668021577"
              className="mt-5 flex items-center gap-2 bg-leaf text-white
                         text-sm font-semibold px-5 py-3 rounded-xl touch-target
                         transition-colors hover:bg-leaf/90"
            >
              <Phone className="w-4 h-4" />
              No cabs — call to book · +91 96680 21577
            </a>
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
              <SeatPills
                totalSeats={ride.total_seats ?? ride.available_seats}
                availableSeats={ride.available_seats}
              />
            </div>

            {/* Fare + book */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-display text-2xl text-forest">
                  ₹{Math.round(ride.fare_paise / 100)}
                </span>
                <p className="text-xs text-sub mt-0.5">Full Cab</p>
              </div>
              <button
                onClick={() => setBookingRide(ride)}
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

      {bookingRide && (
        <DriverSheet
          open={!!bookingRide}
          onClose={() => setBookingRide(null)}
          from={bookingRide.from_city}
          to={bookingRide.to_city}
          fareRupees={Math.round(bookingRide.fare_paise / 100)}
          date={date}
        />
      )}

      <BottomNav />
    </div>
  );
}
