"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Phone, ArrowRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";

type ReqStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface Req {
  id:          string;
  rider_phone: string;
  from_city:   string;
  to_city:     string;
  fare_paise:  number;
  travel_date: string;
  status:      ReqStatus;
  rider:       { name: string | null; phone: string };
}

const STATUS_COLORS: Record<ReqStatus, string> = {
  PENDING:     "bg-gold/10 text-gold",
  CONFIRMED:   "bg-leaf/10 text-leaf",
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  COMPLETED:   "bg-gray-100 text-gray-500",
  CANCELLED:   "bg-red-50 text-red-500",
};

const NEXT_STATUS: Partial<Record<ReqStatus, ReqStatus>> = {
  PENDING:     "CONFIRMED",
  IN_PROGRESS: "COMPLETED",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function BookingsContent({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const filterStatus = searchParams.get("status") as ReqStatus | null;
  const [requests, setRequests]   = useState<Req[]>([]);
  const [loading, setLoading]     = useState(true);
  const [active, setActive]       = useState<ReqStatus | "ALL">(filterStatus ?? "ALL");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [driverName, setDriverName]     = useState("");
  const [driverPhone, setDriverPhone]   = useState("");
  const [etaMin, setEtaMin]             = useState("");
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    const url = active === "ALL" ? "/api/admin/requests" : `/api/admin/requests?status=${active}`;
    setLoading(true);
    setConfirmingId(null);
    setDriverName("");
    setDriverPhone("");
    setEtaMin("");
    fetch(url, { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setRequests(j.data ?? []))
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [token, active]);

  async function updateStatus(id: string, status: ReqStatus) {
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Update failed"); return; }
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch { toast.error("Network error"); }
  }

  function openConfirmForm(id: string) {
    setConfirmingId(id);
    setDriverName("");
    setDriverPhone("");
    setEtaMin("");
  }

  function closeConfirmForm() {
    setConfirmingId(null);
    setDriverName("");
    setDriverPhone("");
    setEtaMin("");
  }

  async function confirmRequest(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          status:       "CONFIRMED",
          driver_name:  driverName.trim() || undefined,
          driver_phone: driverPhone.trim() || undefined,
          eta_min:      etaMin ? parseInt(etaMin, 10) : undefined,
        }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Confirm failed"); return; }
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "CONFIRMED" } : r));
      closeConfirmForm();
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  const tabs: (ReqStatus | "ALL")[] = ["ALL", "PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 hover:text-lime">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-xl text-white">Bookings</h1>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActive(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                active === t ? "bg-leaf text-white" : "bg-forest-mid text-lime/60 hover:text-lime"
              )}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-sub text-sm">No {active !== "ALL" ? active.toLowerCase() : ""} requests</div>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-1.5 font-semibold text-text">
                  <span>{req.from_city}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-sub flex-shrink-0" />
                  <span>{req.to_city}</span>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", STATUS_COLORS[req.status])}>
                  {req.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-sub mb-3 font-mono-green">
                <span>{fmtDate(req.travel_date)}</span>
                <span>·</span>
                <span className="font-semibold text-forest">₹{Math.round(req.fare_paise / 100)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-sub">Rider</p>
                  <p className="text-sm font-semibold text-text">
                    {req.rider.name ?? "—"} · {req.rider_phone}
                  </p>
                </div>
                <a href={`tel:${req.rider_phone}`}
                  className="w-9 h-9 rounded-full bg-pale flex items-center justify-center">
                  <Phone className="w-4 h-4 text-leaf" />
                </a>
              </div>
              <p className="text-[10px] text-sub/60 mt-2 font-mono-green">#{req.id.slice(0, 8).toUpperCase()}</p>

              {(NEXT_STATUS[req.status] || req.status === "CONFIRMED") && confirmingId !== req.id && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {NEXT_STATUS[req.status] && (
                    <button
                      onClick={() => req.status === "PENDING" ? openConfirmForm(req.id) : updateStatus(req.id, NEXT_STATUS[req.status]!)}
                      className="flex-1 bg-leaf text-white text-sm font-semibold py-2.5 rounded-xl">
                      {req.status === "PENDING" ? "Confirm →" : "Mark Done ✓"}
                    </button>
                  )}
                  {(req.status === "PENDING" || req.status === "CONFIRMED") && (
                    <button
                      onClick={() => updateStatus(req.id, "CANCELLED")}
                      className="px-4 bg-red-50 text-red-500 text-sm font-semibold py-2.5 rounded-xl">
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {confirmingId === req.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-sub uppercase tracking-wide">Driver details (optional)</p>
                  <input
                    type="text"
                    placeholder="Driver name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-warm border border-border rounded-xl px-3 py-2.5 text-sm text-text
                               outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30"
                  />
                  <input
                    type="tel"
                    placeholder="Driver phone"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full bg-warm border border-border rounded-xl px-3 py-2.5 text-sm text-text
                               outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30"
                  />
                  <input
                    type="number"
                    placeholder="ETA in minutes (e.g. 30)"
                    value={etaMin}
                    min={1}
                    max={600}
                    onChange={(e) => setEtaMin(e.target.value)}
                    className="w-full bg-warm border border-border rounded-xl px-3 py-2.5 text-sm text-text
                               outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => confirmRequest(req.id)}
                      disabled={saving}
                      className="flex-1 bg-leaf disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Booking ✓"}
                    </button>
                    <button
                      onClick={closeConfirmForm}
                      className="px-4 bg-warm text-sub text-sm font-semibold py-2.5 rounded-xl">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <AdminGate>
      {(token) => (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-cream"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}>
          <BookingsContent token={token} />
        </Suspense>
      )}
    </AdminGate>
  );
}
