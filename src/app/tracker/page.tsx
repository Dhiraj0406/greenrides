"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { BottomNav } from "@/components/shared/BottomNav";
import { AppBar } from "@/components/shared/AppBar";

interface ActiveTrip {
  id:           string;
  from_city:    string;
  to_city:      string;
  fare_paise:   number;
  travel_date:  string;
  status:       "CONFIRMED" | "IN_PROGRESS";
  driver_name:  string | null;
  driver_phone: string | null;
  eta_min:      number | null;
  trip_otp:     string | null;
}

function LiveTripCard({ trip }: { trip: ActiveTrip }) {
  const progress   = trip.status === "IN_PROGRESS" ? 62 : 20;
  const fareRupees = Math.round(trip.fare_paise / 100);

  return (
    <div className="mx-4 rounded-2xl overflow-hidden" style={{ boxShadow: "var(--sh-lg)" }}>
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-2"
        style={{ background: "var(--green)" }}
      >
        <span
          className="w-2 h-2 rounded-full animate-live-pulse flex-shrink-0"
          style={{ background: "#4ade80" }}
        />
        <span className="text-white text-sm font-semibold flex-1">Trip in Progress</span>
        {trip.trip_otp && (
          <span className="text-xs font-mono text-white/60">OTP: {trip.trip_otp}</span>
        )}
      </div>

      {/* Body */}
      <div className="bg-white p-5">
        {/* Route */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--ink-4)" }}>From</p>
            <p className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
              {trip.from_city}
            </p>
          </div>
          <span className="text-2xl" style={{ color: "var(--ink-3)" }}>→</span>
          <div className="text-right">
            <p className="text-xs mb-0.5" style={{ color: "var(--ink-4)" }}>To</p>
            <p className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
              {trip.to_city}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mb-6">
          <div className="h-2 rounded-full" style={{ background: "var(--green-4)" }}>
            <div
              className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: "var(--green-3)" }}
            />
          </div>
          <span
            className="absolute top-0 -translate-y-3/4 animate-car-float text-lg pointer-events-none"
            style={{ left: `${Math.min(progress, 90)}%` }}
          >
            🚗
          </span>
          {trip.eta_min && (
            <span
              className="absolute -top-7 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                left:      `${Math.min(progress, 90)}%`,
                transform: "translateX(-50%)",
                background: "var(--green-5)",
                color:      "var(--green)",
              }}
            >
              ~{trip.eta_min} min
            </span>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3" style={{ background: "var(--paper-2)" }}>
            <p className="text-xs mb-0.5" style={{ color: "var(--ink-4)" }}>Driver</p>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {trip.driver_name ?? "Assigning…"}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--paper-2)" }}>
            <p className="text-xs mb-0.5" style={{ color: "var(--ink-4)" }}>Fare</p>
            <p className="font-display text-base font-bold" style={{ color: "var(--green)" }}>
              ₹{fareRupees.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Share bar */}
        <div
          className="pt-4 border-t flex items-center gap-2"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-xs flex-1" style={{ color: "var(--ink-3)" }}>
            Share with family
          </span>
          {trip.driver_phone && (
            <a
              href={`https://wa.me/${trip.driver_phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--wa-l)", color: "var(--wa)" }}
            >
              WhatsApp
            </a>
          )}
          <button
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard.writeText(url).catch(() => {});
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
          >
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="text-5xl mb-4 opacity-40">🚗</div>
      <h2 className="font-display text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>
        No active trip
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
        Your live ride will appear here once a driver is assigned.
      </p>
      <button
        onClick={() => router.push("/")}
        className="px-6 py-3 rounded-full text-sm font-semibold text-white"
        style={{ background: "var(--green)" }}
      >
        Book a ride →
      </button>
    </div>
  );
}

export default function TrackerPage() {
  const router = useRouter();
  const [trip, setTrip]       = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveTrip = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login?next=/tracker"); return; }

      const { data } = await supabase
        .from("RideRequest")
        .select("id, from_city, to_city, fare_paise, travel_date, status, driver_name, driver_phone, eta_min, trip_otp")
        .eq("rider_id", session.user.id)
        .in("status", ["CONFIRMED", "IN_PROGRESS"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setTrip(data as ActiveTrip | null);
    } catch {
      toast.error("Could not load trip status");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchActiveTrip(); }, [fetchActiveTrip]);

  // Poll every 10s while trip is active
  useEffect(() => {
    if (!trip) return;
    const interval = setInterval(fetchActiveTrip, 10_000);
    return () => clearInterval(interval);
  }, [trip, fetchActiveTrip]);

  return (
    <div className="green-container min-h-screen pb-24" style={{ background: "var(--paper-2)" }}>
      <AppBar />

      <div className="pt-4">
        <div className="px-4 mb-4">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
            Live Tracker
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Your current trip status
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--green-4)", borderTopColor: "var(--green)" }}
            />
          </div>
        ) : trip ? (
          <LiveTripCard trip={trip} />
        ) : (
          <EmptyState />
        )}
      </div>

      <BottomNav />
    </div>
  );
}
