"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, SkipForward, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";

interface Dispatch {
  id:         string;
  expires_at: string;
  driver:     { name: string | null; phone: string };
  request:    { from_city: string; to_city: string; fare_paise: number; travel_date: string };
}

interface PendingRequest {
  id:          string;
  from_city:   string;
  to_city:     string;
  fare_paise:  number;
  travel_date: string;
  rider_phone: string;
  dispatched:  boolean;
}

interface DriverOption {
  id:      string; // DriverProfile.id
  user_id: string; // User.id — used as driver_id in DriverDispatch
  name:    string | null;
  phone:   string;
}

function DispatchContent({ token }: { token: string }) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading]       = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [driverQuery, setDriverQuery]   = useState("");
  const [drivers, setDrivers]           = useState<DriverOption[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  // null means not dispatching from a request; set to request.id when creating new dispatch
  const [dispatchingRequestId, setDispatchingRequestId] = useState<string | null>(null);
  const [dispatchQuery, setDispatchQuery]   = useState("");
  const [dispatchDrivers, setDispatchDrivers] = useState<DriverOption[]>([]);
  const [loadingDispatchDrivers, setLoadingDispatchDrivers] = useState(false);
  const [creatingDispatch, setCreatingDispatch] = useState(false);

  const load = () => {
    fetch("/api/admin/dispatch", { headers: { "x-admin-token": token } })
      .then(r => r.json())
      .then(j => setDispatches(j.data ?? []))
      .catch(() => toast.error("Failed to load dispatches"))
      .finally(() => setLoading(false));
  };

  const loadRequests = () => {
    setLoadingRequests(true);
    fetch("/api/admin/requests?status=PENDING", { headers: { "x-admin-token": token } })
      .then(r => r.json())
      .then(j => setPendingRequests(j.data ?? []))
      .catch(() => toast.error("Failed to load pending requests"))
      .finally(() => setLoadingRequests(false));
  };

  useEffect(() => {
    load();
    loadRequests();
    const id = setInterval(() => { load(); loadRequests(); }, 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const searchDrivers = async (q: string) => {
    setLoadingDrivers(true);
    try {
      const res  = await fetch(`/api/admin/drivers?approved=1&q=${encodeURIComponent(q)}`, {
        headers: { "x-admin-token": token },
      });
      const json = await res.json();
      const raw  = (json.data ?? []).slice(0, 8) as Array<{
        id: string; user_id: string; user?: { name?: string | null; phone?: string } | null;
      }>;
      setDrivers(raw.map(d => ({ id: d.id, user_id: d.user_id, name: d.user?.name ?? null, phone: d.user?.phone ?? "" })));
    } finally {
      setLoadingDrivers(false);
    }
  };

  const searchDispatchDrivers = async (q: string) => {
    setLoadingDispatchDrivers(true);
    try {
      const res  = await fetch(`/api/admin/drivers?approved=1&q=${encodeURIComponent(q)}`, {
        headers: { "x-admin-token": token },
      });
      const json = await res.json();
      const raw  = (json.data ?? []).slice(0, 8) as Array<{
        id: string; user_id: string; user?: { name?: string | null; phone?: string } | null;
      }>;
      setDispatchDrivers(raw.map(d => ({ id: d.id, user_id: d.user_id, name: d.user?.name ?? null, phone: d.user?.phone ?? "" })));
    } finally {
      setLoadingDispatchDrivers(false);
    }
  };

  async function assign(dispatchId: string, driverUserId: string) {
    try {
      const res = await fetch(`/api/admin/dispatch/${dispatchId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ action: "assign", driver_id: driverUserId }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Assign failed"); return; }
      setAssigningId(null);
      setDriverQuery("");
      setDrivers([]);
      load();
    } catch { toast.error("Network error"); }
  }

  async function skip(id: string) {
    try {
      const res = await fetch(`/api/admin/dispatch/${id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ action: "skip" }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Skip failed"); return; }
      load();
    } catch { toast.error("Network error"); }
  }

  async function createDispatch(requestId: string, driverUserId: string) {
    setCreatingDispatch(true);
    try {
      const res = await fetch("/api/admin/dispatch", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ request_id: requestId, driver_user_id: driverUserId }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Dispatch failed"); return; }
      toast.success("Driver dispatched");
      setDispatchingRequestId(null);
      setDispatchQuery("");
      setDispatchDrivers([]);
      load();
      loadRequests();
    } catch { toast.error("Network error"); }
    finally { setCreatingDispatch(false); }
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center gap-3">
          <Link href="/admin/drivers" className="text-lime/70 hover:text-lime"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display text-xl text-white">Live Dispatch</h1>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-6">

        {/* ── Pending Ride Requests ── */}
        <section>
          <h2 className="font-semibold text-text text-sm mb-2">Pending Requests</h2>
          {loadingRequests ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-leaf" /></div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-center py-8 text-sub text-sm">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((r) => (
                <div key={r.id} className="bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-text">{r.from_city} → {r.to_city}</p>
                      <p className="text-xs text-sub">
                        ₹{Math.round(r.fare_paise / 100)} · {new Date(r.travel_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {r.rider_phone}
                      </p>
                      {r.dispatched && <span className="text-xs text-amber-600 font-medium">Already dispatched</span>}
                    </div>
                    <button
                      onClick={() => { setDispatchingRequestId(r.id); setDispatchQuery(""); setDispatchDrivers([]); }}
                      className="flex items-center gap-1.5 bg-leaf/10 text-leaf border border-leaf/20 text-xs font-semibold px-3 py-2 rounded-xl shrink-0 ml-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> Dispatch
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Active Dispatches ── */}
        <section>
          <h2 className="font-semibold text-text text-sm mb-2">Active Dispatches</h2>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>
          ) : dispatches.length === 0 ? (
            <div className="text-center py-8 text-sub text-sm">No active dispatches</div>
          ) : (
            <div className="space-y-3">
              {dispatches.map((d) => {
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => skip(d.id)}
                        className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-2 rounded-xl"
                      >
                        <SkipForward className="w-3.5 h-3.5" /> Skip to next driver
                      </button>
                      <button
                        onClick={() => { setAssigningId(d.id); setDriverQuery(""); setDrivers([]); }}
                        className="flex items-center gap-1.5 bg-leaf/10 text-leaf border border-leaf/20 text-xs font-semibold px-3 py-2 rounded-xl"
                      >
                        Assign Driver
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ── Assign Driver Modal (for overriding active dispatch) ── */}
      {assigningId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-text mb-4">Assign to Driver</h3>
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={driverQuery}
              onChange={(e) => {
                setDriverQuery(e.target.value);
                if (e.target.value.length >= 2) searchDrivers(e.target.value);
                else setDrivers([]);
              }}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30 mb-3"
              autoFocus
            />
            {loadingDrivers && <p className="text-xs text-sub text-center py-2">Searching…</p>}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {drivers.map((d) => (
                <button
                  key={d.id}
                  onClick={() => assign(assigningId, d.user_id)}
                  className="w-full text-left p-3 rounded-xl border border-border hover:border-leaf/40 hover:bg-leaf/5 transition-all"
                >
                  <p className="text-sm font-semibold text-text">{d.name ?? "—"}</p>
                  <p className="text-xs text-sub">{d.phone}</p>
                </button>
              ))}
              {!loadingDrivers && driverQuery.length >= 2 && drivers.length === 0 && (
                <p className="text-xs text-sub text-center py-4">No drivers found</p>
              )}
            </div>
            <button
              onClick={() => { setAssigningId(null); setDriverQuery(""); setDrivers([]); }}
              className="mt-4 w-full py-3 rounded-xl border border-border text-sm font-semibold text-sub"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Create Dispatch Modal (for pending request) ── */}
      {dispatchingRequestId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-text mb-4">Select Driver to Dispatch</h3>
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={dispatchQuery}
              onChange={(e) => {
                setDispatchQuery(e.target.value);
                if (e.target.value.length >= 2) searchDispatchDrivers(e.target.value);
                else setDispatchDrivers([]);
              }}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30 mb-3"
              autoFocus
            />
            {loadingDispatchDrivers && <p className="text-xs text-sub text-center py-2">Searching…</p>}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dispatchDrivers.map((d) => (
                <button
                  key={d.id}
                  disabled={creatingDispatch}
                  onClick={() => createDispatch(dispatchingRequestId, d.user_id)}
                  className="w-full text-left p-3 rounded-xl border border-border hover:border-leaf/40 hover:bg-leaf/5 transition-all disabled:opacity-50"
                >
                  <p className="text-sm font-semibold text-text">{d.name ?? "—"}</p>
                  <p className="text-xs text-sub">{d.phone}</p>
                </button>
              ))}
              {!loadingDispatchDrivers && dispatchQuery.length >= 2 && dispatchDrivers.length === 0 && (
                <p className="text-xs text-sub text-center py-4">No drivers found</p>
              )}
            </div>
            <button
              onClick={() => { setDispatchingRequestId(null); setDispatchQuery(""); setDispatchDrivers([]); }}
              className="mt-4 w-full py-3 rounded-xl border border-border text-sm font-semibold text-sub"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDispatchPage() {
  return <AdminGate>{(token) => <DispatchContent token={token} />}</AdminGate>;
}
