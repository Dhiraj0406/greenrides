"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Clock, Phone, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DispatchRequest {
  id:          string;
  from_city:   string;
  to_city:     string;
  fare_paise:  number;
  travel_date: string;
  status:      string;
  rider_phone: string;
  trip_otp:    string | null;
  notes:       string | null;
}
interface ActiveDispatch {
  id:         string;
  status:     "PENDING" | "ACCEPTED";
  expires_at: string | null;
  request_id: string;
  request:    DispatchRequest | null;
}

interface TodayBooking {
  amount_paise: number;
  pickup_point: string;
  seats:        number;
  status:       string;
  rider:        { name: string | null; phone: string };
}
interface TodayRide {
  id:             string;
  from_city:      string;
  to_city:        string;
  departure_time: string;
  status:         string;
  bookings:       TodayBooking[];
}

// ─── Dispatch Card ───────────────────────────────────────────────────────────

function ExpiryCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );
  useEffect(() => {
    if (secsLeft <= 0) { onExpired(); return; }
    const id = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) { clearInterval(id); onExpired(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const urgent = secsLeft <= 30;
  return (
    <span className={`font-mono font-bold tabular-nums ${urgent ? "text-red-500" : "text-leaf"}`}>
      {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
}

function DispatchCard({
  dispatch,
  token,
  onRefresh,
}: {
  dispatch:  ActiveDispatch;
  token:     string;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [arrived,  setArrived]  = useState(false);
  const req = dispatch.request;

  async function respond(action: "accept" | "reject") {
    setLoading(true);
    try {
      const res  = await fetch(`/api/requests/${dispatch.request_id}/respond`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ action, dispatch_id: dispatch.id }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      toast.success(action === "accept" ? "Ride accepted!" : "Ride rejected");
      onRefresh();
    } catch { toast.error("Network error — please try again"); }
    finally { setLoading(false); }
  }

  async function startTrip() {
    if (otpInput.length !== 6) { toast.error("Enter the 6-digit OTP from the rider"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/requests/${dispatch.request_id}/start`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ otp: otpInput }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to start trip"); return; }
      toast.success("Trip started!");
      onRefresh();
    } catch { toast.error("Network error — please try again"); }
    finally { setLoading(false); }
  }

  async function completeTrip() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/requests/${dispatch.request_id}/complete`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to complete trip"); return; }
      toast.success("Trip completed!");
      onRefresh();
    } catch { toast.error("Network error — please try again"); }
    finally { setLoading(false); }
  }

  const fare = req ? `₹${Math.round(req.fare_paise / 100)}` : "";
  const travelDate = req
    ? new Date(req.travel_date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", timeZone: "Asia/Kolkata",
      })
    : "";

  if (dispatch.status === "PENDING") {
    return (
      <div className="bg-white border-2 border-leaf rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-leaf uppercase tracking-wide mb-3">
          <span className="w-2 h-2 rounded-full bg-leaf animate-pulse inline-block" />
          New ride request
        </div>
        <div className="flex items-center gap-2 font-semibold text-text text-base mb-1">
          <MapPin className="w-4 h-4 text-leaf" />
          {req?.from_city} <ArrowRight className="w-3.5 h-3.5 text-sub" /> {req?.to_city}
        </div>
        <div className="flex items-center gap-3 text-sm text-sub mb-4">
          <span className="font-display text-forest text-xl">{fare}</span>
          <span>·</span>
          <Clock className="w-3.5 h-3.5" />
          <span>{travelDate}</span>
          {dispatch.expires_at && (
            <>
              <span>·</span>
              <ExpiryCountdown expiresAt={dispatch.expires_at} onExpired={onRefresh} />
            </>
          )}
        </div>
        {req?.notes && (
          <p className="text-xs text-sub bg-cream rounded-xl px-3 py-2 mb-3">{req.notes}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => respond("reject")}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-500 font-semibold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
          <button
            onClick={() => respond("accept")}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-leaf text-white font-semibold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Accept
          </button>
        </div>
      </div>
    );
  }

  // ACCEPTED dispatch — req.status is CONFIRMED or IN_PROGRESS
  if (req?.status === "CONFIRMED") {
    return (
      <div className="bg-forest rounded-2xl p-4 mb-3 text-white">
        <p className="text-xs font-bold text-lime/60 uppercase tracking-wide mb-2">Ride confirmed</p>
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          {req.from_city} <ArrowRight className="w-3.5 h-3.5 text-lime/60" /> {req.to_city}
        </div>
        <div className="flex items-center gap-2 text-sm text-lime/70 mb-4">
          <span className="font-semibold text-white text-lg">{fare}</span>
          <span>·</span>
          <span>{travelDate}</span>
        </div>
        {req.rider_phone && (
          <a
            href={`tel:${req.rider_phone}`}
            className="flex items-center justify-center gap-2 bg-white/15 text-white text-sm font-semibold py-2.5 rounded-xl mb-3"
          >
            <Phone className="w-4 h-4" /> Call Rider · {req.rider_phone}
          </a>
        )}
        {!arrived ? (
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch(`/api/requests/${dispatch.request_id}/arrived`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${token}` },
                });
                const j = await res.json();
                if (!res.ok) { toast.error(j.error ?? "Failed"); return; }
                setArrived(true);
                toast.success("Rider notified — you've arrived!");
              } catch { toast.error("Network error"); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="w-full mb-3 bg-white/20 text-white font-semibold text-sm py-2.5 rounded-xl disabled:opacity-50"
          >
            📍 I&apos;ve Arrived at Pickup
          </button>
        ) : (
          <div className="bg-white/10 rounded-xl px-4 py-2.5 mb-3 text-center">
            <p className="text-lime text-sm font-semibold">✓ Rider notified — you&apos;ve arrived!</p>
          </div>
        )}
        <p className="text-sm text-lime/70 mb-2">Ask the rider for the 6-digit OTP to start the trip.</p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter OTP"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="flex-1 bg-white/10 text-white placeholder-lime/40 border border-white/20 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-center outline-none focus:border-lime/60"
          />
          <button
            onClick={startTrip}
            disabled={loading || otpInput.length !== 6}
            className="bg-leaf text-white font-semibold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start"}
          </button>
        </div>
      </div>
    );
  }

  if (req?.status === "IN_PROGRESS") {
    return (
      <div className="bg-forest rounded-2xl p-4 mb-3 text-white">
        <div className="flex items-center gap-1.5 text-xs font-bold text-lime/60 uppercase tracking-wide mb-2">
          <span className="w-2 h-2 rounded-full bg-lime animate-pulse inline-block" />
          Trip in progress
        </div>
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          {req.from_city} <ArrowRight className="w-3.5 h-3.5 text-lime/60" /> {req.to_city}
        </div>
        <p className="text-sm text-lime/70 mb-4">{fare} · {travelDate}</p>
        {req.rider_phone && (
          <a
            href={`tel:${req.rider_phone}`}
            className="flex items-center justify-center gap-2 bg-white/15 text-white text-sm font-semibold py-2.5 rounded-xl mb-3"
          >
            <Phone className="w-4 h-4" /> Call Rider · {req.rider_phone}
          </a>
        )}
        <p className="text-xs text-lime/60 flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse inline-block" />
          Sharing location
        </p>
        <button
          onClick={completeTrip}
          disabled={loading}
          className="w-full bg-leaf text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Complete Trip"}
        </button>
      </div>
    );
  }

  if (req?.status === "CANCELLED") {
    return (
      <div className="bg-red-50 border border-red-300 rounded-2xl p-4 mb-3">
        <p className="text-sm font-semibold text-red-600 mb-1">Booking Cancelled</p>
        <p className="text-xs text-sub">The rider or admin cancelled this booking.</p>
      </div>
    );
  }

  return null;
}

// ─── Notification sound ───────────────────────────────────────────────────────

function playDispatchAlert() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5 — ascending major chord
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch {}
  try { navigator.vibrate?.([200, 80, 200]); } catch {}
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const router                    = useRouter();
  const [token, setToken]         = useState("");
  const [dispatches, setDispatches] = useState<ActiveDispatch[]>([]);
  const [rides, setRides]         = useState<TodayRide[]>([]);
  const [ridesError, setRidesError] = useState(false);
  const [loading, setLoading]     = useState(true);
  const loadedOnce   = useRef(false);
  const prevPending  = useRef(0);

  const fetchDispatches = useCallback(async (accessToken: string) => {
    try {
      const res  = await fetch("/api/fleet/dispatches", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      setDispatches(json.data ?? []);
    } catch { /* non-fatal — dispatches will remain stale until next poll */ }
  }, []);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) { setLoading(false); router.replace("/fleet/login"); return; }
        const t = session.access_token;
        setToken(t);
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        Promise.all([
          fetchDispatches(t),
          fetch(`/api/rides/driver?date=${today}`, { headers: { Authorization: `Bearer ${t}` } })
            .then((r) => r.json())
            .then((j) => setRides(j.data ?? []))
            .catch(() => { setRidesError(true); toast.error("Failed to load today's rides"); }),
        ]).finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, [fetchDispatches]);

  const hasActiveDispatches = dispatches.length > 0;

  // Poll dispatches every 15s — always refresh the session token so long-lived sessions stay active
  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/fleet/login"); return; }
      setToken(session.access_token);
      fetchDispatches(session.access_token);
    }, 15_000);
    return () => clearInterval(id);
  }, [token, fetchDispatches, router]);

  // GPS ping loop — active only while a trip is IN_PROGRESS.
  // Derived outside the effect so React compares by value, not by array reference,
  // preventing the interval from restarting on every 15s dispatch poll.
  const inProgressId = dispatches.find(
    (d) => d.status === "ACCEPTED" && d.request?.status === "IN_PROGRESS"
  )?.request_id ?? null;

  useEffect(() => {
    if (!inProgressId || !token) return;

    function ping() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch("/api/location/ping", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({
              request_id: inProgressId,
              lat:        pos.coords.latitude,
              lng:        pos.coords.longitude,
              heading:    pos.coords.heading ?? undefined,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }

    ping();
    const interval = setInterval(ping, 10_000);

    return () => clearInterval(interval);
  }, [inProgressId, token]);

  // Play alert when a new dispatch arrives after initial load
  const pendingDispatches  = dispatches.filter((d) => d.status === "PENDING");
  const acceptedDispatches = dispatches.filter((d) => d.status === "ACCEPTED");

  useEffect(() => {
    if (loading) return;
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      prevPending.current = pendingDispatches.length;
      return;
    }
    if (pendingDispatches.length > prevPending.current) {
      playDispatchAlert();
    }
    prevPending.current = pendingDispatches.length;
  }, [pendingDispatches.length, loading]);

  return (
    <div className="px-4 py-6">
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-leaf" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── Incoming requests ──────────────────────── */}
          {pendingDispatches.length > 0 && (
            <section className="mb-6">
              <h2 className="font-display text-xl text-forest mb-3">Incoming Request</h2>
              {pendingDispatches.map((d) => (
                <DispatchCard key={d.id} dispatch={d} token={token} onRefresh={() => fetchDispatches(token)} />
              ))}
            </section>
          )}

          {/* ── Active / confirmed trips ────────────────── */}
          {acceptedDispatches.length > 0 && (
            <section className="mb-6">
              <h2 className="font-display text-xl text-forest mb-3">Active Trip</h2>
              {acceptedDispatches.map((d) => (
                <DispatchCard key={d.id} dispatch={d} token={token} onRefresh={() => fetchDispatches(token)} />
              ))}
            </section>
          )}

          {/* ── Posted rides (existing section) ────────── */}
          <section>
            <h2 className="font-display text-xl text-forest mb-3">Today&apos;s Rides</h2>
            {ridesError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3 text-center">
                <p className="text-red-500 text-sm">Failed to load today&apos;s rides.</p>
                <button
                  onClick={() => {
                    setRidesError(false);
                    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                    supabase.auth.getSession().then(({ data: { session } }) => {
                      if (!session) return;
                      fetch(`/api/rides/driver?date=${today}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
                        .then((r) => r.json())
                        .then((j) => setRides(j.data ?? []))
                        .catch(() => { setRidesError(true); toast.error("Still failing — check connection"); });
                    }).catch(() => {});
                  }}
                  className="mt-1 text-xs text-red-400 underline"
                >Retry</button>
              </div>
            )}
            {!ridesError && rides.length === 0 && pendingDispatches.length === 0 && acceptedDispatches.length === 0 && (
              <p className="text-center text-sub text-sm py-12">No rides or requests for today.</p>
            )}
            {rides.map((ride) => (
              <div key={ride.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
                  <MapPin className="w-4 h-4 text-leaf" />
                  {ride.from_city} → {ride.to_city}
                </div>
                <div className="flex items-center gap-1 text-xs text-sub mb-3">
                  <Clock className="w-3 h-3" />
                  {new Date(ride.departure_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {ride.bookings.map((b, i) => (
                  <div key={i} className="border-t border-border pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-text">{b.rider.name ?? "Rider"}</p>
                        <p className="text-xs text-sub">Pickup: {b.pickup_point} · {b.seats} seat{b.seats > 1 ? "s" : ""}</p>
                        <p className="text-xs text-forest font-semibold mt-0.5">₹{Math.round(b.amount_paise / 100)}</p>
                      </div>
                      <a
                        href={`tel:${b.rider.phone}`}
                        className="w-8 h-8 rounded-full bg-pale flex items-center justify-center"
                      >
                        <Phone className="w-3.5 h-3.5 text-leaf" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
