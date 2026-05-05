// ── Enums (mirrored from Prisma for client-safe usage) ───────────────────────

export type UserRole      = "RIDER" | "DRIVER" | "ADMIN";
export type RideStatus    = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "REFUNDED";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

// ── API response wrapper ─────────────────────────────────────────────────────

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// ── Route/Fare types ─────────────────────────────────────────────────────────

export interface RouteInfo {
  from_city:    string;
  to_city:      string;
  distance_km:  number;
  duration_min: number;
  duration_text: string;
  fare_paise:   number;
  fare_rupees:  number;
  discount_pct?: number;
  discount_label?: string;
}

export interface FareEstimateResult {
  from:         string;
  to:           string;
  distance_km:  number;
  duration_min: number;
  duration_text: string;
  fare:         number;
  confidence:   "high" | "medium" | "low";
  notes:        string;
}

// ── Driver / Ride types ──────────────────────────────────────────────────────

export interface DriverSummary {
  id:            string;
  name:          string;
  phone:         string;
  avatar_url:    string | null;
  vehicle_type:  string;
  vehicle_number: string;
  vehicle_model: string;
  avg_rating:    number;
  total_trips:   number;
}

export interface RideWithDriver {
  id:             string;
  from_city:      string;
  to_city:        string;
  departure_time: string;
  total_seats:    number;
  available_seats: number;
  fare_paise:     number;
  pickup_points:  string[];
  notes:          string | null;
  status:         RideStatus;
  driver:         DriverSummary;
}

// ── Booking types ────────────────────────────────────────────────────────────

export interface BookingConfirmation {
  booking_id:        string;
  razorpay_order_id: string;
  amount_paise:      number;
  from:              string;
  to:                string;
  departure_time:    string;
  driver_name:       string;
  driver_phone:      string;
  vehicle_number:    string;
  pickup_point:      string;
}

// ── Location ─────────────────────────────────────────────────────────────────

export interface Coords {
  lat: number;
  lng: number;
}

export interface CityDetectResult {
  city:       string;
  confidence: "gps" | "fallback";
}

// ── Tourist places ───────────────────────────────────────────────────────────

export interface TouristPlace {
  name:        string;
  description: string;
  city:        string;
  image_hint:  string;
  tag:         string;
}
