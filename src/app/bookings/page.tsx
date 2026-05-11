"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calendar, Car, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";

interface MyRequest {
  id:           string;
  from_city:    string;
  to_city:      string;
  fare_paise:   number;
  travel_date:  string;
  status:       "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  notes:        string | null;
  driver_name:  string | null;
  driver_phone: string | null;
  eta_min:      number | null;
  created_at:   string;
}

function formatTravelDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
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
    </div>
  );
}

function RequestCard({ request }: { request: MyRequest }) {
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
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [token, setToken]       = useState("");

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/bookings");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? "";
      setToken(accessToken);
      await fetchRequests(accessToken);
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
              <RequestCard key={req.id} request={req} />
            ))}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
