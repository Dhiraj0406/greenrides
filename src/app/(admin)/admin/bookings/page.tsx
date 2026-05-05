"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface AdminBooking {
  id:           string;
  amount_paise: number;
  seats:        number;
  status:       string;
  created_at:   string;
  ride: {
    from_city: string;
    to_city:   string;
  };
  rider: {
    name:  string | null;
    phone: string;
  };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/bookings?admin=1", {
      headers: { "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "" },
    })
      .then((r) => r.json())
      .then((j) => setBookings(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="green-container min-h-screen bg-cream pb-10">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link
            href="/admin"
            className="w-8 h-8 rounded-full bg-forest-mid flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-lime" />
          </Link>
          <span className="font-display text-xl text-lime">All Bookings</span>
        </div>
      </header>

      <div className="px-4 mt-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        {!loading && !bookings.length && (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="w-8 h-8 text-sub mb-2" />
            <p className="text-sub text-sm">No bookings yet.</p>
          </div>
        )}

        {!loading && bookings.map((b) => (
          <div
            key={b.id}
            className="bg-white border border-border rounded-2xl p-4 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-text">
                <span>{b.ride.from_city}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sub" />
                <span>{b.ride.to_city}</span>
              </div>
              <StatusBadge status={b.status as never} />
            </div>

            <div className="flex items-center justify-between text-xs text-sub">
              <span>{b.rider.name ?? b.rider.phone}</span>
              <span className="font-mono-green">
                {new Date(b.created_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="font-display text-lg text-forest">
                ₹{Math.round(b.amount_paise / 100)}
              </span>
              <span className="text-xs text-sub font-mono-green">
                {b.seats} seat{b.seats > 1 ? "s" : ""} ·{" "}
                {b.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
