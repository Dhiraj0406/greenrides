"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Users, Loader2, Leaf } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { todayISO } from "@/lib/utils";
import type { RideWithDriver } from "@/types";

export default function DriverDashboard() {
  const [rides, setRides]     = useState<RideWithDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, filter by driver_id from auth session
    fetch(`/api/rides?date=${todayISO()}`)
      .then((r) => r.json())
      .then((j) => setRides(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-lime" />
            <span className="font-display text-xl text-lime">Driver Dashboard</span>
          </div>
          <Link
            href="/driver/post-ride"
            className="flex items-center gap-1.5 bg-leaf text-white text-sm
                       font-semibold px-4 py-2 rounded-xl touch-target"
          >
            <Plus className="w-4 h-4" />
            Post Ride
          </Link>
        </div>
      </header>

      <div className="px-4 mt-6">
        <h2 className="text-base font-semibold text-text mb-4">Today's Rides</h2>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        {!loading && !rides.length && (
          <div className="bg-white border border-border rounded-2xl p-8 text-center">
            <p className="text-sub text-sm mb-4">You haven't posted any rides today.</p>
            <Link
              href="/driver/post-ride"
              className="inline-flex items-center gap-2 bg-leaf text-white text-sm
                         font-semibold px-5 py-3 rounded-xl"
            >
              <Plus className="w-4 h-4" />
              Post your first ride
            </Link>
          </div>
        )}

        {!loading && rides.map((ride) => (
          <div
            key={ride.id}
            className="bg-white border border-border rounded-2xl p-4 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <span>{ride.from_city}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sub" />
                <span>{ride.to_city}</span>
              </div>
              <StatusBadge status={ride.status as never} />
            </div>

            <div className="flex items-center gap-4 text-xs text-sub font-mono-green mb-3">
              <span>
                {new Date(ride.departure_time).toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {ride.available_seats}/{ride.total_seats} seats
              </span>
              <span>₹{Math.round(ride.fare_paise / 100)}</span>
            </div>

            <Link
              href={`/driver/dashboard?ride=${ride.id}`}
              className="text-xs text-leaf font-semibold"
            >
              View bookings →
            </Link>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
