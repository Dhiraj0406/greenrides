"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Star, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Driver {
  id:             string;
  user_id:        string;
  vehicle_model:  string;
  vehicle_number: string;
  license_number: string;
  is_approved:    boolean;
  avg_rating:     number;
  total_trips:    number;
  user:           { name: string | null; phone: string };
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/drivers", {
      headers: { "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "" },
    })
      .then((r) => r.json())
      .then((j) => setDrivers(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleApproval(driver: Driver) {
    setToggling(driver.id);
    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}`, {
        method:  "PATCH",
        headers: {
          "Content-Type":  "application/json",
          "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "",
        },
        body: JSON.stringify({ is_approved: !driver.is_approved }),
      });
      const json = await res.json();
      if (!json.error) {
        setDrivers((prev) =>
          prev.map((d) =>
            d.id === driver.id ? { ...d, is_approved: !d.is_approved } : d
          )
        );
      }
    } finally {
      setToggling(null);
    }
  }

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
          <span className="font-display text-xl text-lime">Drivers</span>
        </div>
      </header>

      <div className="px-4 mt-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        {!loading && !drivers.length && (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="w-8 h-8 text-sub mb-2" />
            <p className="text-sub text-sm">No drivers registered yet.</p>
          </div>
        )}

        {!loading && drivers.map((driver) => (
          <div
            key={driver.id}
            className="bg-white border border-border rounded-2xl p-4 mb-3"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-text text-sm">
                  {driver.user.name ?? "Unnamed"}
                </p>
                <p className="text-xs text-sub font-mono-green">{driver.user.phone}</p>
              </div>
              <button
                onClick={() => toggleApproval(driver)}
                disabled={toggling === driver.id}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                  driver.is_approved
                    ? "bg-leaf/10 text-leaf hover:bg-red-50 hover:text-red-500"
                    : "bg-gold/10 text-gold hover:bg-leaf/10 hover:text-leaf"
                }`}
              >
                {toggling === driver.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : driver.is_approved ? (
                  "Approved"
                ) : (
                  "Pending"
                )}
              </button>
            </div>

            <p className="text-xs text-sub mb-1">
              {driver.vehicle_model} · {driver.vehicle_number}
            </p>
            <p className="text-xs text-sub mb-2">
              License: {driver.license_number}
            </p>

            <div className="flex items-center gap-3 text-xs text-sub font-mono-green">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-gold text-gold" />
                {driver.avg_rating.toFixed(1)}
              </span>
              <span>{driver.total_trips} trips</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
