"use client";

import { useEffect, useState } from "react";
import { Leaf, Loader2, Plus, Star, ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { OnlineToggle } from "@/components/drivers/OnlineToggle";
import { DispatchCard } from "@/components/drivers/DispatchCard";
import { AvailabilityCalendar } from "@/components/drivers/AvailabilityCalendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "home" | "requests" | "earnings" | "schedule" | "rides" | "profile";

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

interface ProfileData {
  name:           string | null;
  phone:          string | null;
  vehicle_type:   string | null;
  vehicle_number: string | null;
  vehicle_model:  string | null;
  license_number: string | null;
  avg_rating:     number;
  total_trips:    number;
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

  // Per-tab loading states
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingRides, setLoadingRides]       = useState(false);

  // Profile tab
  const [profile, setProfile]             = useState<ProfileData | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm]     = useState({
    name: "", license_number: "", vehicle_number: "", vehicle_model: "", vehicle_type: "",
  });

  async function reloadDriver(token: string) {
    try {
      const res  = await fetch("/api/drivers/me", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.data) {
        setDriver(json.data);
        setLocalAvail(json.data.availability ?? {});
      }
    } catch { /* non-fatal — driver data remains stale */ }
    setLoading(false);
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let token = "";

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        token = session.access_token;
        setUserId(session.user.id);
        await reloadDriver(token);

        // Realtime: auto-show DispatchCard when a PENDING dispatch arrives
        channel = supabase
          .channel(`driver-dispatch-${session.user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "DriverDispatch", filter: `driver_id=eq.${session.user.id}` },
            () => { reloadDriver(token); }
          )
          .subscribe();
      } catch { setLoading(false); }
    })();

    return () => { channel?.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load requests tab data
  useEffect(() => {
    if (tab !== "requests" || !userId) return;
    setLoadingRequests(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoadingRequests(false); return; }
      try {
        const { data } = await supabase
          .from("DriverDispatch")
          .select("id, status, dispatched_at, responded_at, request:RideRequest(from_city, to_city, fare_paise, travel_date)")
          .eq("driver_id", session.user.id)
          .neq("status", "WAITING")
          .order("created_at", { ascending: false })
          .limit(30);
        setDispatches(data ?? []);
      } catch { toast.error("Failed to load dispatch history"); }
      setLoadingRequests(false);
    }).catch(() => setLoadingRequests(false));
  }, [tab, userId]);

  // Load rides tab data
  useEffect(() => {
    if (tab !== "rides" || !userId) return;
    setLoadingRides(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoadingRides(false); return; }
      try {
        const { data } = await supabase
          .from("Ride")
          .select("id, from_city, to_city, departure_time, fare_paise, status, available_seats, total_seats")
          .eq("driver_id", session.user.id)
          .order("departure_time", { ascending: false })
          .limit(20);
        setRides(data ?? []);
      } catch { toast.error("Failed to load rides"); }
      setLoadingRides(false);
    }).catch(() => setLoadingRides(false));
  }, [tab, userId]);

  useEffect(() => {
    if (tab !== "earnings" || !userId || earningsLoaded) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setEarningsLoaded(true); return; }
      try {
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
      } catch { toast.error("Failed to load earnings"); }
      finally { setEarningsLoaded(true); }
    }).catch(() => { toast.error("Failed to load earnings"); setEarningsLoaded(true); });
  }, [tab, userId, earningsLoaded]);

  // Load profile tab data
  useEffect(() => {
    if (tab !== "profile" || profileLoaded) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setProfileLoaded(true); return; }
      try {
        const res = await fetch("/api/fleet/driver/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const j = await res.json();
        if (j.data) {
          setProfile(j.data);
          setProfileForm({
            name:           j.data.name           ?? "",
            license_number: j.data.license_number ?? "",
            vehicle_number: j.data.vehicle_number ?? "",
            vehicle_model:  j.data.vehicle_model  ?? "",
            vehicle_type:   j.data.vehicle_type   ?? "",
          });
        }
      } catch { toast.error("Failed to load profile"); }
      setProfileLoaded(true);
    }).catch(() => setProfileLoaded(true));
  }, [tab, profileLoaded]);

  async function saveAvailability() {
    setSavingAvail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSavingAvail(false); return; }
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

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSavingProfile(false); return; }
      const res = await fetch("/api/fleet/driver/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(profileForm),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error ?? "Save failed"); return; }
      setProfile(p => p ? { ...p, ...profileForm } : p);
      toast.success("Profile saved");
    } catch { toast.error("Network error"); }
    finally { setSavingProfile(false); }
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
    { key: "profile",  label: "Me"       },
  ];

  const inputClass = "w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30";

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
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
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/drivers"; }}
            className="p-1.5 rounded-lg text-lime/50 hover:text-lime transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 pb-3 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-shrink-0 flex-1 py-2 text-[11px] font-bold rounded-t-lg transition-all",
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
              <>
                <div className="bg-white border border-border rounded-2xl p-6 text-center text-sm text-sub">
                  {driver.is_online
                    ? "You're online. Waiting for ride requests…"
                    : "Go online to start receiving ride requests."}
                </div>
                <a href="/drivers/post-ride"
                  className="bg-white border border-border rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-leaf/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-leaf" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text text-sm">Post a Ride</p>
                    <p className="text-xs text-sub">Share your route and earn more</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-sub" />
                </a>
              </>
            )}
          </>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <>
            <h2 className="text-sm font-semibold text-text">Dispatch History</h2>
            {loadingRequests ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-leaf" />
              </div>
            ) : (dispatches as Array<Record<string, unknown>>).length === 0 ? (
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

              const last7 = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
              });
              const dayLabels = last7.map((day) =>
                new Date(day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)
              );
              const dailyEarnings = last7.map((day) => {
                const rSum = (earnings.rides as Array<Record<string, unknown>>).reduce((s, r) => {
                  const rDay = new Date(r.departure_time as string).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                  if (rDay !== day) return s;
                  const booked = (r.total_seats as number) - (r.available_seats as number);
                  return s + Math.round((r.fare_paise as number) / 100) * booked;
                }, 0);
                const qSum = (earnings.requests as Array<Record<string, unknown>>).reduce((s, d2) => {
                  const req = d2.request as Record<string, unknown> | null;
                  if (!req) return s;
                  const rDay = new Date(req.travel_date as string).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                  if (rDay !== day) return s;
                  return s + Math.round((req.fare_paise as number) / 100);
                }, 0);
                return rSum + qSum;
              });
              const maxE = Math.max(...dailyEarnings, 1);
              const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

              return (
                <>
                  {tripCount > 0 && (
                    <div className="bg-white border border-border rounded-2xl p-4 mb-2">
                      <p className="text-xs font-bold text-sub uppercase tracking-wide mb-3">Last 7 Days</p>
                      <div className="flex items-end gap-1.5 h-16">
                        {last7.map((day, i) => (
                          <div key={day} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className={`w-full rounded-t-md ${day === todayKey ? "bg-leaf" : "bg-leaf/50"}`}
                              style={{ height: `${Math.max(4, (dailyEarnings[i] / maxE) * 56)}px` }}
                            />
                            <span className="text-[9px] text-sub">{dayLabels[i]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
            {(() => {
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              let availableDays = 0;
              for (let d = 1; d <= daysInMonth; d++) {
                const key = new Date(year, month, d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                if ((localAvail as Record<string, unknown>)[key] !== "rest") availableDays++;
              }
              return (
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 mb-2 ${availableDays === 0 ? "bg-gold/10" : "bg-pale"}`}>
                  <span className="text-sm font-semibold text-text">
                    {availableDays === 0
                      ? "No available days this month — mark your schedule"
                      : `${availableDays} available days this month`}
                  </span>
                </div>
              );
            })()}
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
            {loadingRides ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-leaf" />
              </div>
            ) : (rides as Array<Record<string, unknown>>).length === 0 ? (
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

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <>
            {!profileLoaded ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-leaf" />
              </div>
            ) : (
              <>
                <div className="bg-forest rounded-2xl p-5 text-white">
                  <p className="text-lime/60 text-xs mb-1">
                    ★ {profile?.avg_rating?.toFixed(1) ?? "—"} · {profile?.total_trips ?? 0} trips
                  </p>
                  <p className="font-display text-2xl text-lime">{profile?.name ?? "—"}</p>
                  <p className="text-lime/60 text-sm">{profile?.phone ?? "—"}</p>
                </div>

                {(() => {
                  const fields = [
                    profileForm.name.trim(),
                    profileForm.license_number.trim(),
                    profileForm.vehicle_number.trim(),
                    profileForm.vehicle_model.trim(),
                  ];
                  const filled = fields.filter(Boolean).length;
                  const pct = Math.round((filled / fields.length) * 100);
                  const missing = [
                    !profileForm.name.trim() && "name",
                    !profileForm.license_number.trim() && "licence number",
                    !profileForm.vehicle_number.trim() && "vehicle number",
                    !profileForm.vehicle_model.trim() && "vehicle model",
                  ].filter(Boolean);
                  return (
                    <div className="bg-white border border-border rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-text">Profile {pct}% complete</p>
                        {pct === 100 && <span className="text-xs text-leaf font-semibold">✓ All done</span>}
                      </div>
                      <div className="bg-pale h-2 rounded-full w-full mb-2">
                        <div className="bg-leaf h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      {missing.length > 0 && (
                        <p className="text-xs text-sub">Missing: {missing.join(", ")}</p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Licence number"
                    value={profileForm.license_number}
                    onChange={(e) => setProfileForm(f => ({ ...f, license_number: e.target.value.toUpperCase() }))}
                    className={`${inputClass} font-mono`}
                  />
                  <input
                    type="text"
                    placeholder="Vehicle number"
                    value={profileForm.vehicle_number}
                    onChange={(e) => setProfileForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                    className={`${inputClass} font-mono`}
                  />
                  <input
                    type="text"
                    placeholder="Vehicle model"
                    value={profileForm.vehicle_model}
                    onChange={(e) => setProfileForm(f => ({ ...f, vehicle_model: e.target.value }))}
                    className={inputClass}
                  />
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Profile"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <div className="text-center pt-4 pb-2">
          <a href="/driver-agreement" className="text-[11px] text-sub underline mr-3">Driver Agreement</a>
          <a href="/privacy" className="text-[11px] text-sub underline mr-3">Privacy</a>
          <a href="/terms" className="text-[11px] text-sub underline">Terms</a>
        </div>
      </div>
    </div>
  );
}
