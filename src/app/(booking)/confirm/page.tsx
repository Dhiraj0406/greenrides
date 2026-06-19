"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Phone, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";
import type { BookingConfirmation } from "@/types";

function ConfirmContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const bookingId     = searchParams.get("booking");

  const [data, setData]       = useState<BookingConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!bookingId) { router.replace("/"); return; }

    import("@/lib/supabase").then(({ supabase }) =>
      supabase.auth.getSession()
    ).then(({ data: { session } }) => {
      const headers: Record<string, string> = {};
      if (session) headers["Authorization"] = `Bearer ${session.access_token}`;
      return fetch(`/api/bookings/${bookingId}`, { headers });
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j.data);
      })
      .catch(() => setError("Could not load booking details."))
      .finally(() => setLoading(false));
  }, [bookingId, router]);

  if (loading) {
    return (
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-leaf" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-text font-semibold">Something went wrong</p>
        <p className="text-sub text-sm">{error}</p>
        <button
          onClick={() => router.replace("/")}
          className="bg-leaf text-white px-6 py-3 rounded-xl font-semibold text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      {/* Hero success state */}
      <div className="bg-cream px-4 pt-safe-top pb-6">
        <div className="pt-10 flex flex-col items-center text-center">
          <CheckCircle className="w-16 h-16 text-leaf mb-4" />
          <h1 className="font-display text-2xl text-forest">Booking Confirmed!</h1>
          <p className="text-sub text-sm mt-1">
            Your booking is confirmed. Pay cash to the driver.
          </p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* OTP box */}
        <div className="bg-forest rounded-2xl p-5 flex flex-col items-center text-center">
          <p className="text-lime/60 text-xs uppercase tracking-widest mb-3">
            Show this to your driver
          </p>
          <p className="font-mono text-4xl text-lime tracking-[0.3em]">
            {data.booking_id.slice(0, 6).toUpperCase()}
          </p>
        </div>

        {/* Route + departure */}
        <div className="px-1">
          <p className="text-text font-semibold text-base">
            {data.from} → {data.to}
          </p>
          <p className="text-sub text-sm mt-0.5">
            {new Date(data.departure_time).toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}
            {new Date(data.departure_time).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Booking ID */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-sub mb-1">Booking ID</p>
          <p className="font-mono-green text-sm text-text font-semibold">
            {data.booking_id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Fare */}
        <div className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between">
          <p className="text-xs text-sub">Fare (pay cash)</p>
          <p className="font-display text-xl text-forest">
            ₹{Math.round(data.amount_paise / 100)}
          </p>
        </div>

        {/* Driver */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-sub mb-3 font-semibold uppercase tracking-wide">
            Your Driver
          </p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-forest-mid flex items-center
                            justify-center text-lime font-display text-lg flex-shrink-0">
              {data.driver_name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-text">{data.driver_name}</p>
              <p className="text-sm text-sub">{data.vehicle_number}</p>
            </div>
            <a
              href={`tel:${data.driver_phone}`}
              className="w-10 h-10 rounded-full bg-pale flex items-center justify-center"
            >
              <Phone className="w-4 h-4 text-leaf" />
            </a>
          </div>
        </div>

        {/* Pickup point */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-sub mb-1">Pickup Point</p>
          <p className="text-sm font-semibold text-text">{data.pickup_point}</p>
        </div>

        {/* View My Bookings CTA */}
        <button
          onClick={() => router.push("/bookings")}
          className="w-full flex items-center justify-center gap-2 bg-leaf
                     text-white font-semibold py-4 rounded-xl touch-target
                     text-base transition-colors hover:bg-leaf/90"
        >
          View My Bookings
        </button>

        <button
          onClick={() => router.replace("/")}
          className="w-full text-center text-sm font-semibold text-leaf py-2"
        >
          Back to Home →
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-leaf" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
