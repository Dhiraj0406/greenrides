// Shared platform-level types for the Super-App module layer.
// Keep this file decoupled from the Prisma ORM — no @prisma/client imports.

export enum EntityType {
  RIDE_REQUEST   = "RIDE_REQUEST",
  RIDE           = "RIDE",
  BOOKING        = "BOOKING",
  ASSET          = "ASSET",
  VEHICLE        = "VEHICLE",
}

export enum AssetClass {
  CAB            = "CAB",
  RENTAL         = "RENTAL",
  CARGO          = "CARGO",
  EV_CHARGER     = "EV_CHARGER",
  PARCEL_LOCKER  = "PARCEL_LOCKER",
}

export enum ModuleScope {
  RIDESHARING    = "RIDESHARING",
  RENTALS        = "RENTALS",
  USED_CARS      = "USED_CARS",
  FINTECH        = "FINTECH",
  CARGO          = "CARGO",
  EV_CHARGING    = "EV_CHARGING",
  PLATFORM       = "PLATFORM",
}

// Extended booking status that includes IN_PROGRESS (not in the legacy Prisma enum).
export enum PlatformBookingStatus {
  PENDING        = "PENDING",
  CONFIRMED      = "CONFIRMED",
  IN_PROGRESS    = "IN_PROGRESS",
  COMPLETED      = "COMPLETED",
  CANCELLED      = "CANCELLED",
  REFUNDED       = "REFUNDED",
}

export interface RemoteFlag {
  key:          string;
  value_json:   Record<string, unknown>;
  module_scope: ModuleScope;
  enabled:      boolean;
  updated_at:   string;
}
