"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { Star, Phone, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
  date?:       string;
  rideId?:     string;
  seats?:      number;
}

export function DriverSheet({ open, onClose, from, to, fareRupees, date, rideId, seats }: Props) {
  const router = useRouter();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [travelerName, setTravelerName]     = useState("");
  const [travelerPhone, setTravelerPhone]   = useState("");
  const { setSelectedRide, setBooking: setBookingState } = useBookingStore();

  useEffect(() => {
    if (!open) return;

    // Check auth first — redirect to login if not signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        onClose();
        router.push(`/login?next=/`);
        return;
      }
      setAuthToken(session.access_token);
    });

    setLoading(true);
    track.driverSheetOpened();

    fetch(`/api/rides?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date ?? todayISO()}`)
      .then((r) => r.json())
      .then((j) => {
        setRides(j.data ?? []);
        setLoading(false);
      })
      .catch(() => { toast.error("Failed to load rides"); setLoading(false); });
  }, [open, from, to, date, onClose, router]);

  async function handleBook(ride: RideWithDriver) {
    setBooking(true);
    track.paymentInitiated(fareRupees);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onClose();
        router.push(`/login?next=/`);
        return;
      }

      const res = await fetch("/api/bookings", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          ride_id:        ride.id,
          rider_id:       user.id,
          seats:          seats ?? 1,
          pickup_point:   ride.pickup_points[0] ?? from,
          payment_method: "cash",
          ...(forSomeoneElse && travelerName ? { traveler_name: travelerName, traveler_phone: travelerPhone || null } : {}),
        }),
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setSelectedRide(ride);
      track.bookingConfirmed(json.data.booking_id, Math.round(json.data.amount_paise / 100));
      router.push(`/confirm?booking=${json.data.booking_id}`);
    } catch (err) {
      console.error(err);
      toast.error("Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  const ride = (rideId ? rides.find((r) => r.id === rideId) : rides[0]) ?? null;

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
                  <span>Full cab · Private hire</span>
                </div>
                <p className="font-display text-4xl text-forest mt-3">
                  ₹{fareRupees}
                </p>
              </div>

              {/* Book for someone else toggle */}
              <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forSomeoneElse}
                  onChange={(e) => setForSomeoneElse(e.target.checked)}
                  className="w-4 h-4 accent-leaf rounded"
                />
                <span className="text-sm text-sub">Booking for someone else?</span>
              </label>

              {forSomeoneElse && (
                <div className="mb-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Traveler's name"
                    value={travelerName}
                    onChange={(e) => setTravelerName(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-xl px-4 py-2.5 text-sm text-text outline-none focus:ring-2 ring-leaf/30"
                  />
                  <input
                    type="tel"
                    placeholder="Traveler's phone (optional)"
                    value={travelerPhone}
                    onChange={(e) => setTravelerPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-xl px-4 py-2.5 text-sm text-text outline-none focus:ring-2 ring-leaf/30"
                  />
                </div>
              )}

              {/* Book button */}
              <button
                onClick={() => handleBook(ride)}
                disabled={booking || (forSomeoneElse && !travelerName.trim())}
                className="w-full bg-leaf hover:bg-leaf/90 disabled:opacity-60
                           text-white font-semibold py-4 rounded-xl touch-target
                           flex items-center justify-center gap-2 text-base
                           transition-colors"
              >
                {booking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Book Now · Pay Cash ₹${fareRupees}`
                )}
              </button>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
