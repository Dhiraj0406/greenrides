"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { Star, Phone, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration, getInitials, todayISO } from "@/lib/utils";
import type { RideWithDriver } from "@/types";

interface Props {
  open:        boolean;
  onClose:     () => void;
  from:        string;
  to:          string;
  fareRupees:  number;
}

export function DriverSheet({ open, onClose, from, to, fareRupees }: Props) {
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const { setSelectedRide, setBooking: setBookingState } = useBookingStore();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    track.driverSheetOpened();

    fetch(`/api/rides?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${todayISO()}`)
      .then((r) => r.json())
      .then((j) => {
        setRides(j.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, from, to]);

  async function handleBook(ride: RideWithDriver) {
    setBooking(true);
    track.paymentInitiated(fareRupees);

    try {
      const res = await fetch("/api/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_id:      ride.id,
          rider_id:     "demo-rider-id", // Replace with auth user id
          seats:        1,
          pickup_point: ride.pickup_points[0] ?? from,
        }),
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setSelectedRide(ride);
      setBookingState(json.data.booking_id, json.data.razorpay_order_id, json.data.amount_paise);
      initiateRazorpay(json.data);
    } catch (err) {
      console.error(err);
      alert("Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  function initiateRazorpay(data: {
    razorpay_order_id: string;
    amount_paise: number;
    booking_id: string;
  }) {
    const options = {
      key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount:      data.amount_paise,
      currency:    "INR",
      name:        "Green Rides",
      description: `${from} → ${to}`,
      order_id:    data.razorpay_order_id,
      theme:       { color: "#52b788" },
      handler: function (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) {
        track.bookingConfirmed(data.booking_id, Math.round(data.amount_paise / 100));
        window.location.href = `/confirm?booking=${data.booking_id}`;
      },
    };

    // @ts-expect-error Razorpay loaded via script
    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", () => {
      track.paymentAbandoned(data.booking_id);
      alert("Payment failed. Please try again.");
    });
    rzp.open();
  }

  const ride = rides[0] ?? null;

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 green-container mx-auto
                     bg-white rounded-t-3xl p-6 focus:outline-none"
        >
          <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6" />

          <button
            onClick={onClose}
            className="flex items-center gap-1 text-sm text-sub mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-leaf" />
            </div>
          )}

          {!loading && !ride && (
            <div className="flex flex-col items-center py-10 text-center">
              <AlertCircle className="w-10 h-10 text-sub mb-3" />
              <p className="font-semibold text-text">No rides today</p>
              <p className="text-sm text-sub mt-1">
                No drivers have posted {from} → {to} today.
              </p>
              <p className="text-xs text-sub mt-1">Check back tomorrow or try a custom route.</p>
            </div>
          )}

          {!loading && ride && (
            <>
              {/* Driver card */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-14 h-14 rounded-full bg-forest-mid flex items-center
                               justify-center text-lime font-display text-xl"
                >
                  {getInitials(ride.driver.name)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-text text-lg">{ride.driver.name}</p>
                  <p className="text-sm text-sub">
                    {ride.driver.vehicle_model} · {ride.driver.vehicle_number}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 fill-gold text-gold" />
                    <span className="text-sm font-semibold text-gold">
                      {ride.driver.avg_rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-sub">
                      · {ride.driver.total_trips} trips
                    </span>
                  </div>
                </div>
                <a
                  href={`tel:${ride.driver.phone}`}
                  className="w-10 h-10 rounded-full bg-pale flex items-center justify-center"
                >
                  <Phone className="w-4 h-4 text-leaf" />
                </a>
              </div>

              {/* Trip summary */}
              <div className="bg-pale rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-sub mb-2">
                  <span className="font-semibold text-text">{from}</span>
                  <span>→</span>
                  <span className="font-semibold text-text">{to}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-sub font-mono-green">
                  <span>{ride.fare_paise / 100}km equivalent</span>
                  <span>·</span>
                  <span>{ride.available_seats} seats left</span>
                </div>
                <p className="font-display text-4xl text-forest mt-3">
                  ₹{fareRupees}
                </p>
              </div>

              {/* Book button */}
              <button
                onClick={() => handleBook(ride)}
                disabled={booking}
                className="w-full bg-leaf hover:bg-leaf/90 disabled:opacity-60
                           text-white font-semibold py-4 rounded-xl touch-target
                           flex items-center justify-center gap-2 text-base
                           transition-colors"
              >
                {booking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Book Now · Pay ₹${fareRupees}`
                )}
              </button>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
