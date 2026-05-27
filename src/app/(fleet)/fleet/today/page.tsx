"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Clock, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TodayBooking {
  amount_paise: number; pickup_point: string; seats: number; status: string;
  rider: { name: string | null; phone: string };
}
interface TodayRide {
  id: string; from_city: string; to_city: string;
  departure_time: string; status: string;
  bookings: TodayBooking[];
}

export default function TodayPage() {
  const [rides, setRides]     = useState<TodayRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const today = new Date().toISOString().split("T")[0];
      fetch(`/api/rides/driver?date=${today}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setRides(j.data ?? []); setLoading(false); });
    });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Today&apos;s Rides</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && rides.length === 0 && (
        <p className="text-center text-sub text-sm py-12">No rides scheduled for today.</p>
      )}
      {rides.map((ride) => (
        <div key={ride.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
            <MapPin className="w-4 h-4 text-leaf" />
            {ride.from_city} → {ride.to_city}
          </div>
          <div className="flex items-center gap-1 text-xs text-sub mb-3">
            <Clock className="w-3 h-3" />
            {new Date(ride.departure_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {ride.bookings.map((b, i) => (
            <div key={i} className="border-t border-border pt-3 mt-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-text">{b.rider.name ?? "Rider"}</p>
                  <p className="text-xs text-sub">Pickup: {b.pickup_point} · {b.seats} seat{b.seats > 1 ? "s" : ""}</p>
                  <p className="text-xs text-forest font-semibold mt-0.5">₹{Math.round(b.amount_paise / 100)}</p>
                </div>
                <a href={`tel:${b.rider.phone}`}
                  className="w-8 h-8 rounded-full bg-pale flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5 text-leaf" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
