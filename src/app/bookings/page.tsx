"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calendar, Car, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";

interface MyRequest {
  id:                 string;
  from_city:          string;
  to_city:            string;
  fare_paise:         number;
  travel_date:        string;
  status:             "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  notes:              string | null;
  driver_name:        string | null;
  driver_phone:       string | null;
  eta_min:            number | null;
  razorpay_order_id:  string | null;
  payment_status:     string | null;
  has_rating:         boolean;
  created_at:         string;
}

function formatTravelDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

const STATUS_STYLES: Record<MyRequest["status"], string> = {
  PENDING:   "bg-gold/15 text-gold",
  CONFIRMED: "bg-leaf/15 text-leaf",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-50 text-red-500",
};

function StatusBadge({ status }: { status: MyRequest["status"] }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
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
      if (!session) return;

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

function ConfirmedHeroCard({ req }: { req: MyRequest }) {
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
        <span className="font-semibold text-white">₹{req.fare_paise / 100}</span>
      </div>

      {req.driver_name || req.driver_phone || req.eta_min ? (
        <div className="bg-white/10 rounded-xl p-3 space-y-2">
          {req.driver_name && (
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-lime/60 flex-shrink-0" />
              <span className="text-sm font-semibold">{req.driver_name}</span>
            </div>
          )}
          {req.eta_min && (
            <p className="text-sm text-lime/80">
              Driver arriving in ~{req.eta_min} min
            </p>
          )}
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

      <div className="flex items-center gap-1.5 text-sm text-sub mb-3">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{formatTravelDate(request.travel_date)}</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xl text-forest">₹{fareRupees}</span>
      </div>

      <p className="text-xs text-sub font-mono">#{shortId}</p>

      {request.status === "PENDING" && (
        <p className="text-xs text-leaf mt-2">Call us to confirm your booking.</p>
      )}
      {request.status === "COMPLETED" && !request.has_rating && (
        <button
          onClick={() => onRate(request.id)}
          className="mt-3 w-full text-sm font-semibold text-leaf border border-leaf/30 rounded-xl py-2"
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
  status:         "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "REFUNDED";
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
    PENDING:   "bg-gold/15 text-gold",
    CONFIRMED: "bg-leaf/15 text-leaf",
    COMPLETED: "bg-gray-100 text-gray-500",
    CANCELLED: "bg-red-50 text-red-500",
    REFUNDED:  "bg-blue-50 text-blue-500",
  };
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
      <div className="flex items-center gap-1.5 text-sm text-sub mb-2">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{new Date(booking.departure_time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xl text-forest">₹{fareRupees}</span>
        <span className="text-xs text-sub">{booking.driver_name} · {booking.vehicle_model}</span>
      </div>
      <p className="text-xs text-sub font-mono">#{shortId}</p>
      {booking.status === "COMPLETED" && !booking.has_rating && (
        <button
          onClick={() => onRate(booking.id)}
          className="mt-3 w-full text-sm font-semibold text-leaf border border-leaf/30 rounded-xl py-2"
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
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-leaf/10 flex items-center justify-center mb-5">
        <Car className="w-10 h-10 text-leaf" />
      </div>
      <h2 className="font-display text-xl text-forest mb-2">No trips yet</h2>
      <p className="text-sub text-sm mb-6">Book your first hill-town ride and it will appear here.</p>
      <Link
        href="/"
        className="touch-target bg-leaf text-white font-semibold px-6 py-3 rounded-2xl text-sm inline-flex items-center gap-2"
      >
        Book your first ride
        <ArrowRight className="w-4 h-4" />
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

  const fetchRequests = useCallback(async (accessToken: string) => {
    try {
      const res  = await fetch("/api/requests", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to load trips");
      } else {
        setRequests(json.data ?? []);
        setError(null);
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
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
        if (bJson.data) setBookings(bJson.data);
      } catch { /* silent */ }
      setLoading(false);
    }
    init();
  }, [router, fetchRequests]);

  // Poll every 15s when there's a confirmed ride in flight
  useEffect(() => {
    if (!token) return;
    const hasActive = requests.some((r) => r.status === "CONFIRMED");
    if (!hasActive) return;

    const interval = setInterval(() => fetchRequests(token), 15000);
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
      setRatingFor(null);
    } finally {
      setSubmittingRating(false);
    }
  }

  const confirmed  = requests.filter((r) => r.status === "CONFIRMED");
  const otherReqs  = requests.filter((r) => r.status !== "CONFIRMED");

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

        {!loading && !error && requests.length === 0 && <EmptyState />}

        {!loading && !error && (
          <>
            {confirmed.map((req) => (
              <ConfirmedHeroCard key={req.id} req={req} />
            ))}
            {otherReqs.map((req) => (
              <RequestCard key={req.id} request={req} onRate={(id) => { setRatingFor({ type: "request", id }); setRatingScore(5); }} />
            ))}
          </>
        )}

        {!loading && !error && bookings.length > 0 && (
          <>
            <h2 className="text-xs font-bold text-sub uppercase tracking-wide mt-4">Cab Bookings</h2>
            {bookings.map((b) => (
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
