"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, MapPin, Clock, Phone, Leaf, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";
import type { BookingConfirmation } from "@/types";

export default function ConfirmPage() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const bookingId     = searchParams.get("booking");

  const [data, setData]     = useState<BookingConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (!bookingId) { router.replace("/"); return; }

    fetch(`/api/bookings/${bookingId}`)
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
      {/* Success banner */}
      <div className="bg-forest px-4 pt-safe-top pb-8">
        <div className="pt-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-leaf/20 flex items-center justify-center mb-3">
            <CheckCircle className="w-8 h-8 text-lime" />
          </div>
          <h1 className="font-display text-2xl text-white">Booking Confirmed!</h1>
          <p className="text-lime/70 text-sm mt-1">
            A WhatsApp confirmation has been sent to you
          </p>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-4">
        {/* Booking ID */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-sub mb-1">Booking ID</p>
          <p className="font-mono-green text-sm text-text font-semibold">
            {data.booking_id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Trip summary */}
        <div className="bg-forest rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 text-lime/70 text-sm mb-3">
            <MapPin className="w-4 h-4" />
            <span>{data.from} → {data.to}</span>
          </div>

          <p className="font-display text-4xl text-white mb-4">
            ₹{Math.round(data.amount_paise / 100)}
          </p>

          <div className="flex items-center gap-1 text-lime/60 text-xs font-mono-green">
            <Clock className="w-3 h-3" />
            <span>
              {new Date(data.departure_time).toLocaleTimeString("en-IN", {
                hour:   "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {new Date(data.departure_time).toLocaleDateString("en-IN", {
                day:   "numeric",
                month: "short",
              })}
            </span>
          </div>
        </div>

        {/* Driver card */}
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

        {/* Home button */}
        <button
          onClick={() => router.replace("/")}
          className="w-full flex items-center justify-center gap-2 bg-leaf
                     text-white font-semibold py-4 rounded-xl touch-target
                     text-base transition-colors hover:bg-leaf/90"
        >
          <Leaf className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
