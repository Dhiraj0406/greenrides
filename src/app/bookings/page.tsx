"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calendar, Car, Phone, Ticket, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@/components/shared/LiveMap"), { ssr: false });

interface MyRequest {
  id:                 string;
  from_city:          string;
  to_city:            string;
  fare_paise:         number;
  travel_date:        string;
  status:             "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes:              string | null;
  driver_name:        string | null;
  driver_phone:       string | null;
  eta_min:            number | null;
  razorpay_order_id:  string | null;
  payment_status:     string | null;
  trip_otp:           string | null;
  has_rating:         boolean;
  created_at:         string;
}

function formatTravelDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

const STATUS_STYLES: Record<MyRequest["status"], string> = {
  PENDING:     "bg-gold/15 text-gold",
  CONFIRMED:   "bg-leaf/15 text-leaf",
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  COMPLETED:   "bg-gray-100 text-gray-500",
  CANCELLED:   "bg-red-50 text-red-500",
};

function StatusBadge({ status }: { status: MyRequest["status"] }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// --- Trip status timeline ---
const TIMELINE_STEPS = ["Pending", "Confirmed", "In Progress", "Done"];

const STATUS_TO_STEP: Record<string, number> = {
  PENDING:     0,
  CONFIRMED:   1,
  IN_PROGRESS: 2,
  COMPLETED:   3,
};

function TripTimeline({ status }: { status: string }) {
  // Do not render for CANCELLED
  if (status === "CANCELLED") {
    return (
      <div className="mt-3 mb-1">
        <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">
          Cancelled
        </span>
      </div>
    );
  }

  const activeStep = STATUS_TO_STEP[status] ?? 0;

  return (
    <div className="mt-3 mb-1">
      <div className="flex items-center gap-0">
        {TIMELINE_STEPS.map((step, index) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Step column: circle + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold flex-shrink-0 ${
                  index <= activeStep ? "bg-leaf text-white" : "bg-pale text-sub"
                }`}
              >
                {index + 1}
              </div>
              <span className="text-[8px] text-sub text-center leading-tight w-10">
                {step}
              </span>
            </div>
            {/* Connector bar — not after last step */}
            {index < TIMELINE_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-3 ${
                  index < activeStep ? "bg-leaf" : "bg-pale"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PayNowButton({ requestId, orderId, amountPaise }: { requestId: string; orderId: string; amountPaise: number }) {
  const [paying, setPaying] = useState(false);

  async function handlePay() {
    setPaying(true);
    try {
      if (!(window as unknown as Record<string, unknown>).Razorpay) {
        await new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          document.head.appendChild(s);
        });
      }
      const { data: { session } } = await (await import("@/lib/supabase")).supabase.auth.getSession();
      if (!session) { setPaying(false); return; }

      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
      const rzp = new RazorpayConstructor({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: orderId,
        amount: amountPaise,
        currency: "INR",
        name: "Green Rides",
        description: "Ride Payment",
        handler: async (response: Record<string, string>) => {
          const res = await fetch(`/api/requests/${requestId}/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          });
          const json = await res.json();
          if (json.data?.paid) {
            window.location.reload();
          } else {
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        theme: { color: "#2d6a4f" },
      });
      rzp.open();
    } finally {
      setPaying(false);
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={paying}
      className="mt-3 w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-60"
    >
      {paying ? "Opening payment…" : "💳 Pay Now"}
    </button>
  );
}

function ConfirmedHeroCard({ req, token }: { req: MyRequest; token: string }) {
  async function shareTrip() {
    const url = `${window.location.origin}/track/${req.id}`;
    if (navigator.share) {
      await navigator.share({ title: "Track my Green Rides trip", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Share link copied!");
    }
  }

  return (
    <div className="bg-forest rounded-2xl p-5 mb-4 text-white">
      <div className="flex items-center gap-1.5 text-lime/60 text-xs font-semibold uppercase tracking-wide mb-3">
        <span className="w-2 h-2 rounded-full bg-leaf animate-pulse inline-block" />
        Your ride is confirmed
      </div>

      <div className="flex items-center gap-2 font-semibold text-lg mb-1">
        <span>{req.from_city}</span>
        <ArrowRight className="w-4 h-4 text-lime/60 flex-shrink-0" />
        <span>{req.to_city}</span>
      </div>

      <div className="flex items-center gap-1.5 text-lime/60 text-sm mb-4">
        <Calendar className="w-3.5 h-3.5" />
        <span>{formatTravelDate(req.travel_date)}</span>
        <span>·</span>
        <span className="font-semibold text-white">₹{Math.round(req.fare_paise / 100)}</span>
      </div>

      {req.trip_otp && (
        <div className="bg-white/10 rounded-xl p-3 mb-3 text-center">
          <p className="text-xs text-lime/60 mb-1">Your trip OTP — share with driver at pickup</p>
          <p className="font-mono text-3xl font-bold tracking-widest text-white">{req.trip_otp}</p>
        </div>
      )}

      {req.driver_name || req.driver_phone || req.eta_min !== null ? (
        <div className="bg-white/10 rounded-xl p-3 space-y-2">
          {req.driver_name && (
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-lime/60 flex-shrink-0" />
              <span className="text-sm font-semibold">{req.driver_name}</span>
            </div>
          )}
          {req.eta_min === 0 ? (
            <p className="text-sm text-lime font-bold">📍 Driver has arrived at pickup! Show your OTP.</p>
          ) : req.eta_min ? (
            <p className="text-sm text-lime/80">Driver arriving in ~{req.eta_min} min</p>
          ) : null}
          {req.driver_phone && (
            <a
              href={`tel:${req.driver_phone}`}
              className="flex items-center justify-center gap-2 bg-leaf text-white
                         font-semibold text-sm py-2.5 rounded-xl w-full mt-1"
            >
              <Phone className="w-4 h-4" />
              Call Driver · {req.driver_phone}
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-lime/60">Our team will contact you shortly with driver details.</p>
      )}

      {req.razorpay_order_id && req.payment_status !== "SUCCESS" && (
        <PayNowButton
          requestId={req.id}
          orderId={req.razorpay_order_id}
          amountPaise={req.fare_paise}
        />
      )}

      <LiveMap requestId={req.id} token={token} />

      <button
        onClick={shareTrip}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-white/10 text-white font-semibold text-sm py-2.5 rounded-xl"
      >
        <Share2 className="w-4 h-4" />
        Share trip link
      </button>
    </div>
  );
}

function PendingCard({ req, token, onCancelled }: { req: MyRequest; token: string; onCancelled: (id: string) => void }) {
  const fareRupees = Math.round(req.fare_paise / 100);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/requests/${req.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to cancel"); return; }
      toast.success("Ride cancelled");
      onCancelled(req.id);
    } catch { toast.error("Network error"); }
    finally { setCancelling(false); }
  }

  return (
    <div className="bg-white border border-gold/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-semibold text-text text-base">
          <span>{req.from_city}</span>
          <ArrowRight className="w-4 h-4 text-sub flex-shrink-0" />
          <span>{req.to_city}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse inline-block" />
          Pending
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-sub mb-1">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{formatTravelDate(req.travel_date)}</span>
        <span className="text-sub">·</span>
        <span className="font-semibold text-forest">₹{fareRupees}</span>
      </div>
      <TripTimeline status={req.status} />
      <div className="bg-amber-50 border border-gold/20 rounded-xl p-3 mb-3">
        <p className="text-sm font-semibold text-gold">Finding your driver…</p>
        <p className="text-xs text-sub mt-0.5">We&apos;ll call you once a driver is confirmed.</p>
      </div>
      <div className="flex gap-2">
        <a
          href="tel:+919668021577"
          className="flex-1 flex items-center justify-center gap-2 border border-forest/20 text-forest font-semibold text-sm py-2.5 rounded-xl"
        >
          <Phone className="w-4 h-4" />
          Call Green Rides
        </a>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-4 bg-red-50 text-red-500 font-semibold text-sm py-2.5 rounded-xl disabled:opacity-50"
        >
          {cancelling ? "…" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

function RequestCard({ request, onRate }: { request: MyRequest; onRate: (id: string) => void }) {
  const fareRupees = Math.round(request.fare_paise / 100);
  const shortId = request.id.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <div className="bg-white border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-semibold text-text text-base">
          <span>{request.from_city}</span>
          <ArrowRight className="w-4 h-4 text-sub flex-shrink-0" />
          <span>{request.to_city}</span>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="flex items-center gap-1.5 text-sm text-sub mb-1">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{formatTravelDate(request.travel_date)}</span>
      </div>

      <TripTimeline status={request.status} />

      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xl text-forest">₹{fareRupees}</span>
      </div>

      <p className="text-xs text-sub font-mono">#{shortId}</p>

      {request.status === "CANCELLED" && request.notes && (
        <p className="mt-2 text-xs text-red-400 bg-red-50 rounded-lg px-3 py-2">{request.notes}</p>
      )}
      {request.status === "COMPLETED" && (
        <Link
          href={`/receipt/${request.id}?type=request`}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-forest border border-forest/20 rounded-xl py-2"
        >
          View Receipt →
        </Link>
      )}
      {(request.status === "COMPLETED" || request.status === "CANCELLED") && (
        <Link
          href={`/?from=${encodeURIComponent(request.from_city)}&to=${encodeURIComponent(request.to_city)}`}
          className="mt-2 w-full flex items-center justify-center text-xs font-semibold text-leaf rounded-xl py-2"
        >
          Book same route →
        </Link>
      )}
      {request.status === "COMPLETED" && !request.has_rating && (
        <button
          onClick={() => onRate(request.id)}
          className="mt-1 w-full text-sm font-semibold text-leaf border border-leaf/30 rounded-xl py-2"
        >
          ⭐ Rate this ride
        </button>
      )}
      {request.status === "COMPLETED" && request.has_rating && (
        <p className="mt-2 text-xs text-sub">✓ Rated</p>
      )}
    </div>
  );
}

interface CabBooking {
  id:             string;
  status:         "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "CANCELLED" | "COMPLETED" | "REFUNDED";
  amount_paise:   number;
  seats:          number;
  pickup_point:   string;
  created_at:     string;
  from:           string;
  to:             string;
  departure_time: string;
  driver_name:    string;
  vehicle_number: string;
  vehicle_model:  string;
  has_rating:     boolean;
}

function CabBookingCard({ booking, onRate }: { booking: CabBooking; onRate: (id: string) => void }) {
  const fareRupees = Math.round(booking.amount_paise / 100);
  const shortId = booking.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const STATUS_STYLES: Record<CabBooking["status"], string> = {
    PENDING:     "bg-gold/15 text-gold",
    CONFIRMED:   "bg-leaf/15 text-leaf",
    IN_PROGRESS: "bg-blue-50 text-blue-600",
    COMPLETED:   "bg-gray-100 text-gray-500",
    CANCELLED:   "bg-red-50 text-red-500",
    REFUNDED:    "bg-blue-50 text-blue-500",
  };
  // REFUNDED is not in the 4-step timeline — treat as COMPLETED visually
  const timelineStatus = booking.status === "REFUNDED" ? "COMPLETED" : booking.status;

  return (
    <div className="bg-white border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-semibold text-text text-base">
          <span>{booking.from}</span>
          <ArrowRight className="w-4 h-4 text-sub flex-shrink-0" />
          <span>{booking.to}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[booking.status]}`}>
          {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-sub mb-1">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{new Date(booking.departure_time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</span>
      </div>
      <TripTimeline status={timelineStatus} />
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xl text-forest">₹{fareRupees}</span>
        <span className="text-xs text-sub">{booking.driver_name} · {booking.vehicle_model}</span>
      </div>
      <p className="text-xs text-sub font-mono">#{shortId}</p>
      {booking.status === "COMPLETED" && (
        <Link
          href={`/receipt/${booking.id}?type=booking`}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-forest border border-forest/20 rounded-xl py-2"
        >
          View Receipt →
        </Link>
      )}
      {(booking.status === "COMPLETED" || booking.status === "CANCELLED" || booking.status === "REFUNDED") && (
        <Link
          href={`/?from=${encodeURIComponent(booking.from)}&to=${encodeURIComponent(booking.to)}`}
          className="mt-2 w-full flex items-center justify-center text-xs font-semibold text-leaf rounded-xl py-2"
        >
          Book same route →
        </Link>
      )}
      {booking.status === "COMPLETED" && !booking.has_rating && (
        <button
          onClick={() => onRate(booking.id)}
          className="mt-2 w-full text-sm font-semibold text-leaf border border-leaf/30 rounded-xl py-2"
        >
          ⭐ Rate this ride
        </button>
      )}
      {booking.status === "COMPLETED" && booking.has_rating && (
        <p className="mt-2 text-xs text-sub">✓ Rated</p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-16 gap-3">
      <Ticket className="w-12 h-12 text-sub/40" />
      <h2 className="text-lg font-semibold text-text">No bookings yet</h2>
      <p className="text-sm text-sub">Your upcoming and past rides will appear here</p>
      <Link
        href="/rides"
        className="bg-leaf text-white font-semibold px-5 py-3 rounded-xl text-sm"
      >
        Find a ride →
      </Link>
    </div>
  );
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [bookings, setBookings] = useState<CabBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [token, setToken]       = useState("");
  const [ratingFor, setRatingFor] = useState<{ type: "booking" | "request"; id: string } | null>(null);
  const [ratingScore, setRatingScore]       = useState(5);
  const [submittingRating, setSubmittingRating] = useState(false);
  const prevStatusMapRef = useRef<Record<string, string>>({});

  const fetchRequests = useCallback(async (accessToken: string) => {
    try {
      const res  = await fetch("/api/requests", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to load trips");
      } else {
        const newReqs: MyRequest[] = json.data ?? [];
        if (Object.keys(prevStatusMapRef.current).length > 0) {
          newReqs.forEach((req) => {
            const prev = prevStatusMapRef.current[req.id];
            if (prev && prev !== req.status) {
              if (req.status === "CONFIRMED")
                toast.success(`Driver assigned for ${req.from_city} → ${req.to_city}!`, { duration: 8000 });
              else if (req.status === "IN_PROGRESS")
                toast.info(`Your trip to ${req.to_city} has started!`);
              else if (req.status === "COMPLETED")
                toast.success(`Trip to ${req.to_city} completed!`);
            }
          });
        }
        const map: Record<string, string> = {};
        newReqs.forEach((r) => { map[r.id] = r.status; });
        prevStatusMapRef.current = map;
        setRequests(newReqs);
        setError(null);
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Session may not have hydrated from storage yet — try refreshing
          const { data } = await supabase.auth.refreshSession();
          session = data.session;
        }
        if (!session) {
          router.replace("/login?next=/bookings");
          return;
        }
        const accessToken = session.access_token;
        setToken(accessToken);
        await fetchRequests(accessToken);
        try {
          const bRes  = await fetch("/api/bookings", { headers: { Authorization: `Bearer ${accessToken}` } });
          const bJson = await bRes.json();
          if (bRes.ok && bJson.data) setBookings(bJson.data);
        } catch { /* cab bookings are non-critical — show ride requests even if this fails */ }
      } catch {
        setError("Failed to load your trips.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchRequests]);

  // Poll every 10s while any ride is active (PENDING = finding driver, CONFIRMED/IN_PROGRESS = en route)
  useEffect(() => {
    if (!token) return;
    const hasActive = requests.some((r) => r.status === "PENDING" || r.status === "CONFIRMED" || r.status === "IN_PROGRESS");
    if (!hasActive) return;

    const interval = setInterval(() => fetchRequests(token), 10000);
    return () => clearInterval(interval);
  }, [token, requests, fetchRequests]);

  async function submitRating() {
    if (!ratingFor) return;
    setSubmittingRating(true);
    try {
      const body = ratingFor.type === "booking"
        ? { type: "booking", booking_id: ratingFor.id, score: ratingScore }
        : { type: "request", request_id: ratingFor.id, score: ratingScore };
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Rating failed"); return; }
      if (ratingFor.type === "booking") {
        setBookings(prev => prev.map(b => b.id === ratingFor.id ? { ...b, has_rating: true } : b));
      } else {
        setRequests(prev => prev.map(r => r.id === ratingFor.id ? { ...r, has_rating: true } : r));
      }
      toast.success("Rating submitted!");
      setRatingFor(null);
    } finally {
      setSubmittingRating(false);
    }
  }

  const confirmed      = requests.filter((r) => r.status === "CONFIRMED" || r.status === "IN_PROGRESS");
  const pending        = requests.filter((r) => r.status === "PENDING");
  const otherReqs      = requests.filter((r) => r.status !== "CONFIRMED" && r.status !== "IN_PROGRESS" && r.status !== "PENDING");
  const activeBookings = bookings.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "IN_PROGRESS");
  const pastBookings   = bookings.filter((b) => b.status !== "PENDING" && b.status !== "CONFIRMED" && b.status !== "IN_PROGRESS");

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <h1 className="font-display text-2xl text-white">My Trips</h1>
          <p className="text-lime/60 text-sm mt-1">Your booking history</p>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {loading && (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="touch-target mt-2 text-xs text-red-400 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && requests.length === 0 && bookings.length === 0 && <EmptyState />}

        {!loading && !error && (
          <>
            {(confirmed.length > 0 || pending.length > 0 || activeBookings.length > 0) && (
              <h2 className="text-xs font-bold text-sub uppercase tracking-wide mb-1">Active Trips</h2>
            )}
            {confirmed.map((req) => (
              <ConfirmedHeroCard key={req.id} req={req} token={token} />
            ))}
            {pending.map((req) => (
              <PendingCard
                key={req.id}
                req={req}
                token={token}
                onCancelled={(id) => setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "CANCELLED" } : r))}
              />
            ))}
            {activeBookings.map((b) => (
              <CabBookingCard key={b.id} booking={b} onRate={(id) => { setRatingFor({ type: "booking", id }); setRatingScore(5); }} />
            ))}

            {(otherReqs.length > 0 || pastBookings.length > 0) && (
              <h2 className="text-xs font-bold text-sub uppercase tracking-wide mt-5 mb-1">Past Trips</h2>
            )}
            {otherReqs.map((req) => (
              <RequestCard key={req.id} request={req} onRate={(id) => { setRatingFor({ type: "request", id }); setRatingScore(5); }} />
            ))}
            {pastBookings.map((b) => (
              <CabBookingCard key={b.id} booking={b} onRate={(id) => { setRatingFor({ type: "booking", id }); setRatingScore(5); }} />
            ))}
          </>
        )}

        {ratingFor && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5">
              <h3 className="font-semibold text-text text-base mb-4 text-center">Rate your ride</h3>
              <div className="flex justify-center gap-3 mb-5">
                {[1,2,3,4,5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRatingScore(s)}
                    className={`text-3xl transition-transform ${s <= ratingScore ? "scale-110" : "opacity-30"}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRatingFor(null)}
                  disabled={submittingRating}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-sub"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRating}
                  disabled={submittingRating}
                  className="flex-1 py-3 rounded-xl bg-leaf text-white text-sm font-semibold disabled:opacity-60"
                >
                  {submittingRating ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
