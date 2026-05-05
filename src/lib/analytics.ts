"use client";

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return;
  posthog.init(key, { api_host: host, capture_pageview: false });
  initialized = true;
}

export const track = {
  // Location
  locationDetected: (city: string) =>
    posthog.capture("location_detected", { city }),
  locationManual: (city: string) =>
    posthog.capture("location_manual_select", { city }),

  // Booking funnel
  originSelected: (city: string) =>
    posthog.capture("origin_selected", { city }),
  destinationSelected: (from: string, to: string, fare: number) =>
    posthog.capture("destination_selected", { from, to, fare }),
  customRouteStarted: () =>
    posthog.capture("custom_route_started"),
  fareConfirmed: (from: string, to: string, fare: number) =>
    posthog.capture("fare_confirmed", { from, to, fare }),
  driverSheetOpened: () =>
    posthog.capture("driver_sheet_opened"),
  paymentInitiated: (amount: number) =>
    posthog.capture("payment_initiated", { amount }),
  bookingConfirmed: (bookingId: string, amount: number) =>
    posthog.capture("booking_confirmed", { booking_id: bookingId, amount }),

  // Drop-offs
  paymentAbandoned: (bookingId: string) =>
    posthog.capture("payment_abandoned", { booking_id: bookingId }),
  noRidesFound: (from: string, to: string) =>
    posthog.capture("no_rides_found", { from, to }),
  touristCardTapped: (place: string) =>
    posthog.capture("tourist_card_tapped", { place }),
};
