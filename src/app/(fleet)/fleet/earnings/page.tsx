"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Payout {
  id: string; amount_paise: number; period_from: string; period_to: string;
  status: string; paid_at: string | null;
}
interface EarningsData {
  totalEarned: number;
  payouts: Payout[];
}

export default function EarningsPage() {
  const [data, setData]       = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/fleet/earnings", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setData(j.data ?? null); setLoading(false); });
    });
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Earnings</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && data && (
        <>
          <div className="bg-forest rounded-2xl p-5 mb-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-leaf/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-lime" />
            </div>
            <div>
              <p className="text-lime/70 text-xs">Total Earned</p>
              <p className="text-white text-2xl font-bold">₹{Math.round(data.totalEarned / 100)}</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-text mb-3">Payouts</h3>
          {data.payouts.length === 0 && (
            <p className="text-center text-sub text-sm py-6">No payouts yet.</p>
          )}
          {data.payouts.map((p) => (
            <div key={p.id} className="bg-white border border-border rounded-2xl p-4 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-sub" />
                  <div>
                    <p className="text-sm font-semibold text-text">₹{Math.round(p.amount_paise / 100)}</p>
                    <p className="text-xs text-sub">{fmt(p.period_from)} – {fmt(p.period_to)}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.status === "PAID" ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold"
                }`}>
                  {p.status === "PAID" ? "Paid" : "Pending"}
                </span>
              </div>
              {p.paid_at && (
                <p className="text-[10px] text-sub mt-1 pl-8">Paid on {fmt(p.paid_at)}</p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
