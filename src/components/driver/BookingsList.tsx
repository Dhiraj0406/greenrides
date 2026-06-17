"use client";

import { useEffect, useState } from "react";
import { Phone, Loader2, AlertCircle, Users, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabase } from "@/lib/supabase";

interface BookingItem {
  id:           string;
  rider_name:   string;
  rider_phone:  string;
  seats:        number;
  pickup_point: string;
  amount_paise: number;
  status:       string;
}

interface Props {
  rideId: string;
}

export function BookingsList({ rideId }: Props) {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? "";
      fetch(`/api/rides/${rideId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((j) => { if (j.data) setBookings(j.data.bookings ?? []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, [rideId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-leaf" />
      </div>
    );
  }

  if (!bookings.length) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <AlertCircle className="w-8 h-8 text-sub mb-2" />
        <p className="text-sm text-sub">No bookings yet for this ride.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="font-semibold text-text text-sm">{b.rider_name}</p>
            <StatusBadge status={b.status as never} />
          </div>
          <div className="flex items-center gap-4 text-xs text-sub font-mono-green mb-2">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {b.seats} seat{b.seats > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {b.pickup_point}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-display text-lg text-forest">
              ₹{Math.round(b.amount_paise / 100)}
            </span>
            <a
              href={`tel:${b.rider_phone}`}
              className="flex items-center gap-1.5 bg-pale text-leaf text-xs
                         font-semibold px-3 py-1.5 rounded-xl"
            >
              <Phone className="w-3 h-3" />
              Call
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
