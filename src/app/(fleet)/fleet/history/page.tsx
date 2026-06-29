"use client";

import { useEffect, useState } from "react";
import { Loader2, Car, ArrowRight, CheckCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+05:30");
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // roll back to Monday
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function weekLabel(monStr: string): string {
  const mon = new Date(monStr + "T00:00:00+05:30");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

interface TripRequest {
  id:          string;
  from_city:   string;
  to_city:     string;
  fare_paise:  number;
  travel_date: string;
  status:      string;
}

interface CompletedDispatch {
  id:           string;
  responded_at: string | null;
  created_at:   string;
  request:      TripRequest | null;
}

export default function HistoryPage() {
  const [trips, setTrips]     = useState<CompletedDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      fetch("/api/fleet/history", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { if (j.error) { toast.error(j.error); } else { setTrips(j.data ?? []); } })
        .catch(() => toast.error("Failed to load trip history"))
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const totalEarnings = trips.reduce((sum, d) => sum + (d.request?.fare_paise ?? 0), 0);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Trip History</h2>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-leaf" />
        </div>
      )}

      {!loading && trips.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-sub">
          <Car className="w-12 h-12 text-border" />
          <p className="text-sm font-semibold">No completed trips yet</p>
          <p className="text-xs text-center max-w-xs">
            Completed trips will appear here once you finish your first ride.
          </p>
        </div>
      )}

      {!loading && trips.length > 0 && (() => {
        // Group trips by week
        const grouped = new Map<string, typeof trips>();
        trips.forEach((d) => {
          if (!d.request) return;
          const key = weekStart(d.request.travel_date);
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(d);
        });
        const weeks = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        return (
          <>
            {/* ── All-time summary ─────────────────────────── */}
            <div className="bg-forest rounded-2xl px-4 py-4 mb-4 flex items-center justify-between">
              <p className="text-lime/70 text-sm font-medium">Total earned</p>
              <p className="font-display text-2xl text-white">
                ₹{Math.round(totalEarnings / 100).toLocaleString("en-IN")}
              </p>
            </div>

            {/* ── Weekly breakdown ─────────────────────────── */}
            {weeks.map(([monStr, weekTrips]) => {
              const weekTotal = weekTrips.reduce((s, d) => s + (d.request?.fare_paise ?? 0), 0);
              return (
                <div key={monStr} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-sub uppercase tracking-wide">{weekLabel(monStr)}</p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-forest">
                      <CreditCard className="w-3.5 h-3.5" />
                      ₹{Math.round(weekTotal / 100).toLocaleString("en-IN")}
                    </div>
                  </div>
                  {weekTrips.map((dispatch) => {
                    const req = dispatch.request;
                    if (!req) return null;
                    const date = new Date(req.travel_date).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", timeZone: "Asia/Kolkata",
                    });
                    return (
                      <div key={dispatch.id} className="bg-white border border-border rounded-2xl p-4 mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-text text-sm">
                            <span>{req.from_city}</span>
                            <ArrowRight className="w-3 h-3 text-sub" />
                            <span>{req.to_city}</span>
                          </div>
                          <span className="font-bold text-forest text-sm">
                            ₹{Math.round(req.fare_paise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-sub">
                          <CheckCircle className="w-3 h-3 text-leaf" />
                          <span>{date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        );
      })()}
    </div>
  );
}
