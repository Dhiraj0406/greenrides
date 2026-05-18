"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, SkipForward } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";

interface Dispatch {
  id:         string;
  expires_at: string;
  driver:     { name: string | null; phone: string };
  request:    { from_city: string; to_city: string; fare_paise: number; travel_date: string };
}

function DispatchContent({ token }: { token: string }) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = () => {
    fetch("/api/admin/dispatch", { headers: { "x-admin-token": token } })
      .then(r => r.json())
      .then(j => setDispatches(j.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [token]);

  async function skip(id: string) {
    await fetch(`/api/admin/dispatch/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ action: "skip" }),
    });
    load();
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center gap-3">
          <Link href="/admin/drivers" className="text-lime/70 hover:text-lime"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display text-xl text-white">Live Dispatch</h1>
        </div>
      </header>
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>
        ) : dispatches.length === 0 ? (
          <div className="text-center py-16 text-sub text-sm">No active dispatches</div>
        ) : dispatches.map((d) => {
          const secsLeft = Math.max(0, Math.round((new Date(d.expires_at).getTime() - Date.now()) / 1000));
          return (
            <div key={d.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-text">{d.request.from_city} → {d.request.to_city}</p>
                  <p className="text-xs text-sub">₹{Math.round(d.request.fare_paise / 100)} · {new Date(d.request.travel_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </div>
                <span className={cn("text-sm font-bold font-mono-green", secsLeft <= 15 ? "text-red-500" : "text-amber-600")}>
                  {secsLeft}s
                </span>
              </div>
              <p className="text-sm text-sub mb-3">
                → {d.driver.name ?? "—"} · {d.driver.phone}
              </p>
              <button
                onClick={() => skip(d.id)}
                className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip to next driver
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDispatchPage() {
  return <AdminGate>{(token) => <DispatchContent token={token} />}</AdminGate>;
}
