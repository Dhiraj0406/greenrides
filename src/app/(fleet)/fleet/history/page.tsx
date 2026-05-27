"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface HistoryBooking {
  amount_paise: number; seats: number; status: string;
  rider: { name: string | null };
}
interface HistoryRide {
  id: string; from_city: string; to_city: string;
  departure_time: string; status: string;
  bookings: HistoryBooking[];
}

export default function HistoryPage() {
  const [rides, setRides]     = useState<HistoryRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/rides/driver?all=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setRides(j.data ?? []); setLoading(false); });
    });
  }, []);

  const statusColor = (s: string) =>
    s === "COMPLETED" ? "text-leaf" : s === "CANCELLED" ? "text-red-400" : "text-gold";

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Ride History</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && rides.length === 0 && (
        <p className="text-center text-sub text-sm py-12">No past rides found.</p>
      )}
      {rides.map((ride) => {
        const earned = ride.bookings.reduce((s, b) => s + b.amount_paise, 0);
        return (
          <div key={ride.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <MapPin className="w-4 h-4 text-leaf" />
                {ride.from_city} → {ride.to_city}
              </div>
              <span className={`text-xs font-semibold capitalize ${statusColor(ride.status)}`}>
                {ride.status.toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-sub mb-2">
              <Clock className="w-3 h-3" />
              {new Date(ride.departure_time).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
              {" · "}
              {new Date(ride.departure_time).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-sub">
              <span>{ride.bookings.length} booking{ride.bookings.length !== 1 ? "s" : ""}</span>
              {earned > 0 && (
                <span className="font-semibold text-forest">₹{Math.round(earned / 100)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
