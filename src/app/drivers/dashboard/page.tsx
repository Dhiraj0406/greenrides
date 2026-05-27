"use client";

import { useEffect, useState } from "react";
import { Leaf, Loader2, Plus, Star, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { OnlineToggle } from "@/components/drivers/OnlineToggle";
import { DispatchCard } from "@/components/drivers/DispatchCard";
import { AvailabilityCalendar } from "@/components/drivers/AvailabilityCalendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "home" | "requests" | "earnings" | "schedule" | "rides";

interface DriverData {
  id:              string;
  user_id:         string;
  is_online:       boolean;
  is_approved:     boolean;
  avg_rating:      number;
  total_trips:     number;
  availability:    Record<string, unknown>;
  active_dispatch: null | {
    id:         string;
    request_id: string;
    expires_at: string;
    request:    { from_city: string; to_city: string; fare_paise: number; travel_date: string; notes: string | null } | null;
  };
}

export default function DriverDashboardPage() {
  const [tab, setTab]         = useState<Tab>("home");
  const [driver, setDriver]   = useState<DriverData | null>(null);
  const [userId, setUserId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);
  const [localAvail, setLocalAvail]   = useState<Record<string, unknown>>({});
  const [dispatches, setDispatches]   = useState<unknown[]>([]);
  const [rides, setRides]             = useState<unknown[]>([]);
  const [updatingRide, setUpdatingRide] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ rides: unknown[]; requests: unknown[] }>({ rides: [], requests: [] });
  const [earningsLoaded, setEarningsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const res  = await fetch("/api/drivers/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) {
        setDriver(json.data);
        setLocalAvail(json.data.availability ?? {});
      }
      setLoading(false);
    })();
  }, []);

  // Load requests tab data
  useEffect(() => {
    if (tab !== "requests" || !userId) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("DriverDispatch")
        .select("id, status, dispatched_at, responded_at, request:RideRequest(from_city, to_city, fare_paise, travel_date)")
        .eq("driver_id", session.user.id)
        .neq("status", "WAITING")
        .order("created_at", { ascending: false })
        .limit(30);
      setDispatches(data ?? []);
    });
  }, [tab, userId]);

  // Load rides tab data
  useEffect(() => {
    if (tab !== "rides" || !userId) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("Ride")
        .select("id, from_city, to_city, departure_time, fare_paise, status, available_seats, total_seats")
        .eq("driver_id", session.user.id)
        .order("departure_time", { ascending: false })
        .limit(20);
      setRides(data ?? []);
    });
  }, [tab, userId]);

  useEffect(() => {
    if (tab !== "earnings" || !userId || earningsLoaded) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      const { data: completedRides } = await supabase
        .from("Ride")
        .select("id, from_city, to_city, departure_time, fare_paise, total_seats, available_seats")
        .eq("driver_id", session.user.id)
        .eq("status", "COMPLETED")
        .order("departure_time", { ascending: false })
        .limit(50);

      const { data: acceptedDispatches } = await supabase
        .from("DriverDispatch")
        .select("id, request:RideRequest(id, from_city, to_city, fare_paise, travel_date, status)")
        .eq("driver_id", session.user.id)
        .eq("status", "ACCEPTED")
        .order("created_at", { ascending: false })
        .limit(50);

      const completedRequests = (acceptedDispatches ?? []).filter((d: unknown) => {
        const req = (d as Record<string, unknown>).request as Record<string, unknown> | null;
        return req?.status === "COMPLETED";
      });

      setEarnings({ rides: completedRides ?? [], requests: completedRequests });
      setEarningsLoaded(true);
    });
  }, [tab, userId, earningsLoaded]);

  async function saveAvailability() {
    setSavingAvail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/drivers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ availability: localAvail }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Save failed"); return; }
      setDriver(d => d ? { ...d, availability: localAvail } : d);
      toast.success("Availability saved");
    } finally {
      setSavingAvail(false);
    }
  }

  async function updateRideStatus(rideId: string, newStatus: "IN_PROGRESS" | "COMPLETED") {
    setUpdatingRide(rideId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Update failed"); return; }
      toast.success(newStatus === "IN_PROGRESS" ? "Ride started!" : "Ride completed!");
      setRides(prev => (prev as Array<Record<string, unknown>>).map(r =>
        r.id === rideId ? { ...r, status: newStatus } : r
      ));
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdatingRide(null);
    }
  }

  if (loading) {
    return (
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "home",     label: "Home"     },
    { key: "requests", label: "Requests" },
    { key: "earnings", label: "Earnings" },
    { key: "schedule", label: "Schedule" },
    { key: "rides",    label: "Rides"    },
  ];

  return (
    <div className="green-container min-h-screen bg-cream pb-8">
      {/* Header with tabs */}
      <header className="bg-forest px-4 pt-safe-top pb-0 sticky top-0 z-20">
        <div className="pt-4 flex items-center gap-2 mb-3">
          <Leaf className="w-5 h-5 text-lime" />
          <span className="font-display text-xl text-lime flex-1">Driver Portal</span>
          {driver && (
            <div className="flex items-center gap-1.5 text-xs text-lime/60">
              <Star className="w-3 h-3" />
              {driver.avg_rating.toFixed(1)} · {driver.total_trips} trips
            </div>
          )}
        </div>
        <div className="flex gap-1 pb-3">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 py-2 text-[11px] font-bold rounded-t-lg transition-all",
                tab === t.key
                  ? "bg-cream text-forest"
                  : "text-lime/60 hover:text-lime"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-5 space-y-4">
        {/* HOME TAB */}
        {tab === "home" && driver && (
          <>
            <OnlineToggle
              initialValue={driver.is_online}
              onChanged={(v) => setDriver(d => d ? { ...d, is_online: v } : d)}
            />
            {driver.active_dispatch && (
              <DispatchCard
                driverId={userId!}
                initial={driver.active_dispatch as never}
              />
            )}
            {!driver.active_dispatch && (
              <div className="bg-white border border-border rounded-2xl p-6 text-center text-sm text-sub">
                {driver.is_online
                  ? "You're online. Waiting for ride requests…"
                  : "Go online to start receiving ride requests."}
              </div>
            )}
          </>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <>
            <h2 className="text-sm font-semibold text-text">Dispatch History</h2>
            {(dispatches as Array<Record<string, unknown>>).length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-sub">
                No dispatch history yet.
              </div>
            ) : (
              (dispatches as Array<Record<string, unknown>>).map((d: Record<string, unknown>) => {
                const req = d.request as Record<string, unknown> | null;
                const statusColors: Record<string, string> = {
                  ACCEPTED: "bg-green-50 text-green-700",
                  REJECTED: "bg-red-50 text-red-600",
                  EXPIRED:  "bg-gray-50 text-sub",
                };
                return (
                  <div key={d.id as string} className="bg-white border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-text">
                        {req ? `${req.from_city} → ${req.to_city}` : "—"}
                      </span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", statusColors[d.status as string] ?? "bg-gray-50 text-sub")}>
                        {d.status as string}
                      </span>
                    </div>
                    {req && (
                      <p className="text-xs text-sub">
                        ₹{Math.round((req.fare_paise as number) / 100)} ·{" "}
                        {new Date(req.travel_date as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* EARNINGS TAB */}
        {tab === "earnings" && (
          <>
            {(() => {
              const rideEarnings = (earnings.rides as Array<Record<string, unknown>>).reduce((sum, r) => {
                const booked = (r.total_seats as number) - (r.available_seats as number);
                return sum + Math.round((r.fare_paise as number) / 100) * booked;
              }, 0);
              const requestEarnings = (earnings.requests as Array<Record<string, unknown>>).reduce((sum, d) => {
                const req = d.request as Record<string, unknown> | null;
                return sum + (req ? Math.round((req.fare_paise as number) / 100) : 0);
              }, 0);
              const total = rideEarnings + requestEarnings;
              const tripCount = earnings.rides.length + earnings.requests.length;

              return (
                <>
                  <div className="bg-forest rounded-2xl p-5 text-white mb-2">
                    <p className="text-lime/60 text-xs font-semibold uppercase tracking-wide mb-1">Total Earnings</p>
                    <p className="font-display text-4xl text-lime mb-1">₹{total.toLocaleString("en-IN")}</p>
                    <p className="text-lime/60 text-sm">{tripCount} completed trip{tripCount !== 1 ? "s" : ""}</p>
                  </div>

                  {(earnings.rides as unknown[]).length > 0 && (
                    <>
                      <h3 className="text-xs font-bold text-sub uppercase tracking-wide mt-3 mb-2">Cab Rides</h3>
                      {(earnings.rides as Array<Record<string, unknown>>).map((r) => {
                        const booked = (r.total_seats as number) - (r.available_seats as number);
                        const earned = Math.round((r.fare_paise as number) / 100) * booked;
                        return (
                          <div key={r.id as string} className="bg-white border border-border rounded-2xl p-4 mb-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-text">{r.from_city as string} → {r.to_city as string}</p>
                                <p className="text-xs text-sub mt-0.5">
                                  {new Date(r.departure_time as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} · {booked} seat{booked !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <p className="font-display text-lg text-forest">₹{earned.toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {(earnings.requests as unknown[]).length > 0 && (
                    <>
                      <h3 className="text-xs font-bold text-sub uppercase tracking-wide mt-3 mb-2">Ride Requests</h3>
                      {(earnings.requests as Array<Record<string, unknown>>).map((d) => {
                        const req = d.request as Record<string, unknown> | null;
                        if (!req) return null;
                        const earned = Math.round((req.fare_paise as number) / 100);
                        return (
                          <div key={d.id as string} className="bg-white border border-border rounded-2xl p-4 mb-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-text">{req.from_city as string} → {req.to_city as string}</p>
                                <p className="text-xs text-sub mt-0.5">
                                  {new Date(req.travel_date as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                                </p>
                              </div>
                              <p className="font-display text-lg text-forest">₹{earned.toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {tripCount === 0 && (
                    <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-sub">
                      No completed trips yet. Earnings will appear here after your first completed ride.
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* SCHEDULE TAB */}
        {tab === "schedule" && (
          <>
            <AvailabilityCalendar
              value={localAvail as Record<string, { start: string; end: string } | "rest">}
              onChange={setLocalAvail as (v: Record<string, unknown>) => void}
            />
            <button
              onClick={saveAvailability}
              disabled={savingAvail}
              className="w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
            >
              {savingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Availability"}
            </button>
          </>
        )}

        {/* RIDES TAB */}
        {tab === "rides" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Your Rides</h2>
              <a
                href="/drivers/post-ride"
                className="flex items-center gap-1 bg-leaf text-white text-xs font-bold px-3 py-2 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" /> Post Ride
              </a>
            </div>
            {(rides as Array<Record<string, unknown>>).length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-sub">
                No rides posted yet.
              </div>
            ) : (
              (rides as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => (
                <div key={r.id as string} className="bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-text">
                      <span>{r.from_city as string}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-sub" />
                      <span>{r.to_city as string}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      r.status === "SCHEDULED" ? "bg-amber-50 text-amber-600" :
                      r.status === "IN_PROGRESS" ? "bg-leaf/10 text-leaf" :
                      r.status === "COMPLETED" ? "bg-gray-50 text-sub" : "bg-red-50 text-red-500"
                    )}>
                      {r.status as string}
                    </span>
                  </div>
                  <p className="text-xs text-sub mb-3">
                    {new Date(r.departure_time as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} ·{" "}
                    ₹{Math.round((r.fare_paise as number) / 100)} ·{" "}
                    {r.available_seats as number}/{r.total_seats as number} seats
                  </p>
                  {r.status === "SCHEDULED" && (
                    <button
                      onClick={() => updateRideStatus(r.id as string, "IN_PROGRESS")}
                      disabled={updatingRide === r.id as string}
                      className="w-full bg-leaf text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
                    >
                      {updatingRide === r.id as string ? "Starting…" : "▶ Start Ride"}
                    </button>
                  )}
                  {r.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => updateRideStatus(r.id as string, "COMPLETED")}
                      disabled={updatingRide === r.id as string}
                      className="w-full bg-forest text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
                    >
                      {updatingRide === r.id as string ? "Completing…" : "✓ End Ride"}
                    </button>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
