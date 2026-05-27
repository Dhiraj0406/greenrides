-- Phase 1: add IN_PROGRESS state and trip lifecycle fields to RideRequest.

-- Postgres enums are immutable once committed; add the new value safely.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'IN_PROGRESS'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RideRequestStatus')
  ) THEN
    ALTER TYPE "RideRequestStatus" ADD VALUE 'IN_PROGRESS' AFTER 'CONFIRMED';
  END IF;
END$$;

ALTER TABLE "RideRequest"
  ADD COLUMN IF NOT EXISTS trip_otp    TEXT,
  ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
