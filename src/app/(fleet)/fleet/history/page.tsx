"use client";

import { useEffect, useState } from "react";
import { Loader2, Car, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

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

      {!loading && trips.length > 0 && (
        <>
          {/* ── Earnings summary ─────────────────────────── */}
          <div className="bg-forest rounded-2xl px-4 py-4 mb-4 flex items-center justify-between">
            <p className="text-lime/70 text-sm font-medium">Total earned</p>
            <p className="font-display text-2xl text-white">
              ₹{Math.round(totalEarnings / 100).toLocaleString("en-IN")}
            </p>
          </div>

          {/* ── Trip cards ────────────────────────────────── */}
          {trips.map((dispatch) => {
            const req = dispatch.request;
            if (!req) return null;
            const date = new Date(req.travel_date).toLocaleDateString("en-IN", {
              day:   "numeric",
              month: "short",
              year:  "numeric",
              timeZone: "Asia/Kolkata",
            });
            return (
              <div key={dispatch.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-text text-sm">
                    <span>{req.from_city}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sub" />
                    <span>{req.to_city}</span>
                  </div>
                  <div className="flex items-center gap-1 text-leaf text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Completed
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-sub">
                  <span>{date}</span>
                  <span className="font-bold text-forest text-sm">
                    ₹{Math.round(req.fare_paise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
