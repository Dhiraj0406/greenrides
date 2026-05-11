"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Star, ChevronLeft, Phone, CheckCircle, XCircle } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";

interface Driver {
  id:             string;
  is_approved:    boolean;
  vehicle_type:   string;
  vehicle_number: string;
  vehicle_model:  string;
  license_number: string;
  avg_rating:     number;
  total_trips:    number;
  user: { name: string | null; phone: string };
}

function DriversContent({ token }: { token: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"pending" | "all">("pending");

  useEffect(() => {
    fetch("/api/admin/drivers", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setDrivers(j.data ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleApproval(id: string, approve: boolean) {
    await fetch(`/api/admin/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ is_approved: approve }),
    });
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, is_approved: approve } : d)));
  }

  const filtered = tab === "pending" ? drivers.filter((d) => !d.is_approved) : drivers;

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 hover:text-lime">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-xl text-white">Drivers</h1>
        </div>
        <div className="flex gap-2 mt-3">
          {(["pending", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                tab === t ? "bg-leaf text-white" : "bg-forest-mid text-lime/60 hover:text-lime"
              )}>
              {t === "pending" ? "Pending Approval" : "All Drivers"}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sub text-sm">
            {tab === "pending" ? "No drivers pending approval" : "No drivers registered yet"}
          </div>
        ) : (
          filtered.map((driver) => (
            <div key={driver.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-text">{driver.user.name ?? "—"}</p>
                  <p className="text-xs text-sub">{driver.user.phone}</p>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full",
                  driver.is_approved ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold")}>
                  {driver.is_approved ? "Approved" : "Pending"}
                </span>
              </div>
              <p className="text-sm text-text mb-0.5">
                {driver.vehicle_model} · <span className="font-mono-green">{driver.vehicle_number}</span>
              </p>
              <p className="text-xs text-sub mb-3">{driver.vehicle_type} · License: {driver.license_number}</p>
              <div className="flex items-center gap-4 text-xs text-sub font-mono-green mb-3">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-gold text-gold" />
                  {driver.avg_rating.toFixed(1)}
                </span>
                <span>{driver.total_trips} trips</span>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${driver.user.phone}`}
                  className="flex items-center justify-center gap-1.5 flex-1 bg-pale text-leaf text-sm font-semibold py-2.5 rounded-xl">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
                {!driver.is_approved ? (
                  <button onClick={() => toggleApproval(driver.id, true)}
                    className="flex items-center justify-center gap-1.5 flex-1 bg-leaf text-white text-sm font-semibold py-2.5 rounded-xl">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                ) : (
                  <button onClick={() => toggleApproval(driver.id, false)}
                    className="flex items-center justify-center gap-1.5 flex-1 bg-red-50 text-red-500 text-sm font-semibold py-2.5 rounded-xl">
                    <XCircle className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminDriversPage() {
  return <AdminGate>{(token) => <DriversContent token={token} />}</AdminGate>;
}
