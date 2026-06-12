import { DESTINATIONS } from "./constants";
import type { RouteInfo } from "@/types";

export const STATIC_ROUTES: RouteInfo[] = DESTINATIONS.map((d) => ({
  from_city:      "Koraput",
  to_city:        d.name,
  distance_km:    d.km,
  duration_min:   Math.round(d.km * 1.8),
  duration_text:  d.dur,
  fare_paise:     d.fare * 100,
  fare_rupees:    d.fare,
  discount_pct:   0,
  discount_label: undefined,
}));

// Unique place names across all routes — used for autocomplete
export const ALL_PLACES = [
  "Koraput",
  ...DESTINATIONS.map((d) => d.name),
].sort();
