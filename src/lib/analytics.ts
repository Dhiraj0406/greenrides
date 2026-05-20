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

function capture(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export const track = {
  // Location
  locationDetected: (city: string) =>
    capture("location_detected", { city }),
  locationManual: (city: string) =>
    capture("location_manual_select", { city }),

  // Booking funnel
  originSelected: (city: string) =>
    capture("origin_selected", { city }),
  destinationSelected: (from: string, to: string, fare: number) =>
    capture("destination_selected", { from, to, fare }),
  customRouteStarted: () =>
    capture("custom_route_started"),
  fareConfirmed: (from: string, to: string, fare: number) =>
    capture("fare_confirmed", { from, to, fare }),
  driverSheetOpened: () =>
    capture("driver_sheet_opened"),
  paymentInitiated: (amount: number) =>
    capture("payment_initiated", { amount }),
  bookingConfirmed: (bookingId: string, amount: number) =>
    capture("booking_confirmed", { booking_id: bookingId, amount }),

  // Drop-offs
  paymentAbandoned: (bookingId: string) =>
    capture("payment_abandoned", { booking_id: bookingId }),
  noRidesFound: (from: string, to: string) =>
    capture("no_rides_found", { from, to }),
  touristCardTapped: (place: string) =>
    capture("tourist_card_tapped", { place }),
};
