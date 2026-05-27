import { create } from "zustand";
import type { RideWithDriver } from "@/types";

interface RouteData {
  km:   number;
  min:  number;
  text: string;
  fare: number;
}

interface BookingState {
  // Location
  detectedCity:  string | null;
  origin:        string | null;
  destination:   string | null;

  // Route data
  distanceKm:    number | null;
  durationMin:   number | null;
  durationText:  string | null;

  // Fare
  fareRupees:    number | null;
  fareBase:      number | null;
  discountPct:   number;
  discountLabel: string;

  // Selected ride + driver
  selectedRide:  RideWithDriver | null;

  // Booking in progress
  bookingId:         string | null;
  razorpayOrderId:   string | null;
  amountPaise:       number | null;

  // Actions
  setDetectedCity: (city: string) => void;
  setOrigin:       (city: string) => void;
  setDestination:  (city: string) => void;
  setRouteData:    (data: RouteData) => void;
  setDiscount:     (pct: number, label: string) => void;
  setSelectedRide: (ride: RideWithDriver) => void;
  setBooking:      (id: string, orderId: string, amount: number) => void;
  clearBooking:    () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  detectedCity:    null,
  origin:          null,
  destination:     null,
  distanceKm:      null,
  durationMin:     null,
  durationText:    null,
  fareRupees:      null,
  fareBase:        null,
  discountPct:     0,
  discountLabel:   "",
  selectedRide:    null,
  bookingId:       null,
  razorpayOrderId: null,
  amountPaise:     null,

  setDetectedCity: (city) => set({ detectedCity: city }),

  setOrigin: (city) =>
    set((s) => ({
      origin: city,
      ...(s.origin !== city && {
        destination:   null,
        distanceKm:    null,
        durationMin:   null,
        durationText:  null,
        fareRupees:    null,
        fareBase:      null,
        discountPct:   0,
        discountLabel: "",
        selectedRide:  null,
      }),
    })),

  setDestination: (city) => set({ destination: city }),

  setRouteData: ({ km, min, text, fare }) =>
    set({
      distanceKm:   km,
      durationMin:  min,
      durationText: text,
      fareBase:     fare,
      fareRupees:   fare,
    }),

  setDiscount: (pct, label) =>
    set((s) => ({
      discountPct:   pct,
      discountLabel: label,
      fareRupees: s.fareBase
        ? Math.round((s.fareBase * (1 - pct / 100)) / 5) * 5
        : s.fareRupees,
    })),

  setSelectedRide: (ride) => set({ selectedRide: ride }),

  setBooking: (id, orderId, amount) =>
    set({ bookingId: id, razorpayOrderId: orderId, amountPaise: amount }),

  clearBooking: () =>
    set({
      destination:     null,
      distanceKm:      null,
      durationMin:     null,
      durationText:    null,
      fareRupees:      null,
      fareBase:        null,
      discountPct:     0,
      discountLabel:   "",
      selectedRide:    null,
      bookingId:       null,
      razorpayOrderId: null,
      amountPaise:     null,
    }),
}));
