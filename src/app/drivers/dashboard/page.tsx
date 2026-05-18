"use client";

import { useEffect, useState } from "react";
import { Leaf, Loader2, Plus, Star, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { OnlineToggle } from "@/components/drivers/OnlineToggle";
import { DispatchCard } from "@/components/drivers/DispatchCard";
import { AvailabilityCalendar } from "@/components/drivers/AvailabilityCalendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "home" | "requests" | "schedule" | "rides";

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
                        {new Date(req.travel_date as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                );
              })
            )}
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
                    <span className="text-xs text-sub">{r.status as string}</span>
                  </div>
                  <p className="text-xs text-sub">
                    {new Date(r.departure_time as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                    ₹{Math.round((r.fare_paise as number) / 100)} ·{" "}
                    {r.available_seats as number}/{r.total_seats as number} seats
                  </p>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
