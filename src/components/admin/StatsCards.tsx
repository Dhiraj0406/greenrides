"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Stats {
  total_bookings:    number;
  confirmed_bookings: number;
  total_revenue:     number;
  active_drivers:    number;
}

export function StatsCards() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aggregate from bookings and rides
    Promise.all([
      fetch("/api/bookings?admin=1", { headers: { "x-admin-token": sessionStorage.getItem("green_admin_token") ?? "" } }).then((r) => r.json()),
      fetch("/api/rides?admin=1").then((r) => r.json()),
    ])
      .then(([bookingsRes, ridesRes]) => {
        const bookings = bookingsRes.data ?? [];
        const rides    = ridesRes.data    ?? [];
        const confirmed = bookings.filter((b: { status: string }) =>
          b.status === "CONFIRMED" || b.status === "COMPLETED"
        );
        setStats({
          total_bookings:     bookings.length,
          confirmed_bookings: confirmed.length,
          total_revenue:      confirmed.reduce(
            (sum: number, b: { amount_paise: number }) => sum + b.amount_paise, 0
          ),
          active_drivers: new Set(
            rides.map((r: { driver_id: string }) => r.driver_id)
          ).size,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-leaf" />
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "Total Bookings",    value: stats.total_bookings.toString() },
    { label: "Confirmed",         value: stats.confirmed_bookings.toString() },
    { label: "Revenue Today",     value: `₹${Math.round(stats.total_revenue / 100).toLocaleString()}` },
    { label: "Active Drivers",    value: stats.active_drivers.toString() },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-sub mb-1">{card.label}</p>
          <p className="font-display text-2xl text-forest">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
