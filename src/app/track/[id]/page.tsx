"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, ArrowRight, CheckCircle, Clock, Navigation } from "lucide-react";

interface TripInfo {
  id:          string;
  from:        string;
  to:          string;
  date:        string;
  status:      "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";
  driver_name: string | null;
  eta_min:     number | null;
}

const STATUS_META: Record<TripInfo["status"], { label: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED:   { label: "Driver on the way",  color: "text-leaf",    icon: <Clock className="w-5 h-5" /> },
  IN_PROGRESS: { label: "Trip in progress",   color: "text-blue-500", icon: <Navigation className="w-5 h-5" /> },
  COMPLETED:   { label: "Trip completed",     color: "text-gray-500", icon: <CheckCircle className="w-5 h-5" /> },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const [trip,    setTrip]    = useState<TripInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchTrip = useCallback(async () => {
    try {
      const res  = await fetch(`/api/track/${id}`);
      const json = await res.json();
      if (!res.ok || json.error) { setError("Trip not found or no longer active."); return; }
      setTrip(json.data);
      setError(null);
    } catch { setError("Could not load trip details. Please try again."); }
    finally  { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Auto-refresh every 30s while trip is active
  useEffect(() => {
    if (!trip || trip.status === "COMPLETED") return;
    const id = setInterval(fetchTrip, 30_000);
    return () => clearInterval(id);
  }, [trip, fetchTrip]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="font-semibold text-text">Trip unavailable</p>
        <p className="text-sm text-sub">{error ?? "This trip link is no longer valid."}</p>
        <a href="/" className="text-leaf text-sm font-semibold mt-2">Book a ride →</a>
      </div>
    );
  }

  const meta = STATUS_META[trip.status];

  return (
    <div className="min-h-screen bg-cream">
      {/* Brand header */}
      <div className="bg-forest px-5 pt-safe-top pb-6">
        <div className="pt-4">
          <p className="font-display text-xl font-bold text-white">Green Rides</p>
          <p className="text-lime/50 text-xs mt-0.5 uppercase tracking-widest">Live Trip</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-sm mx-auto space-y-4">
        {/* Status card */}
        <div className={`flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-border`}>
          <span className={meta.color}>{meta.icon}</span>
          <div>
            <p className={`font-semibold text-sm ${meta.color}`}>{meta.label}</p>
            {trip.status === "IN_PROGRESS" && trip.eta_min && (
              <p className="text-xs text-sub mt-0.5">~{trip.eta_min} min remaining</p>
            )}
            {trip.status === "CONFIRMED" && trip.eta_min && (
              <p className="text-xs text-sub mt-0.5">Driver arriving in ~{trip.eta_min} min</p>
            )}
          </div>
        </div>

        {/* Route card */}
        <div className="bg-white rounded-2xl px-5 py-5 border border-border">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-display text-2xl text-forest font-bold">{trip.from}</span>
            <ArrowRight className="w-5 h-5 text-sub flex-shrink-0" />
            <span className="font-display text-2xl text-forest font-bold">{trip.to}</span>
          </div>
          <p className="text-sm text-sub">{fmt(trip.date)}</p>

          {trip.driver_name && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-sub">Driver</p>
              <p className="font-semibold text-text mt-0.5">{trip.driver_name}</p>
            </div>
          )}
        </div>

        {trip.status !== "COMPLETED" && (
          <p className="text-center text-xs text-sub">Updates automatically every 30 seconds</p>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <a href="/" className="text-leaf text-sm font-semibold">Book your own ride →</a>
        </div>
      </div>
    </div>
  );
}
