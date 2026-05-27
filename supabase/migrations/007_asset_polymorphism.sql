-- Phase 3: Polymorphic Asset node.
-- Strategy: additive — Vehicle table stays unchanged; Asset rows shadow each existing vehicle.

-- Enums (idempotent)
DO $$ BEGIN CREATE TYPE "AssetClass"  AS ENUM ('CAB','RENTAL','CARGO','EV_CHARGER','PARCEL_LOCKER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE','INACTIVE','MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Asset table
CREATE TABLE IF NOT EXISTS "Asset" (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class  "AssetClass"  NOT NULL,
  owner_id     TEXT         NOT NULL,
  display_name TEXT         NOT NULL,
  meta_json    JSONB        NOT NULL DEFAULT '{}',
  status       "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT fk_asset_owner FOREIGN KEY (owner_id) REFERENCES "Owner"(id)
);

CREATE INDEX IF NOT EXISTS "Asset_owner_idx"       ON "Asset" (owner_id);
CREATE INDEX IF NOT EXISTS "Asset_class_idx"       ON "Asset" (asset_class);

ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;

-- Owners can read their own assets; service role handles writes
CREATE POLICY IF NOT EXISTS "asset_owner_read" ON "Asset"
  FOR SELECT USING (
    owner_id IN (SELECT id FROM "Owner" WHERE user_id = auth.uid()::text)
  );

-- Add asset_id FK to Vehicle
ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES "Asset"(id);

CREATE INDEX IF NOT EXISTS "Vehicle_asset_idx" ON "Vehicle" (asset_id);

-- Add asset_id column to RideRequest (no FK constraint yet — populated when dispatch is asset-aware)
ALTER TABLE "RideRequest"
  ADD COLUMN IF NOT EXISTS asset_id UUID;

-- Add asset_id column to Booking (no FK constraint yet)
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS asset_id UUID;

-- Backfill: create one Asset(CAB) per existing Vehicle and link back
DO $$
DECLARE
  v           RECORD;
  new_asset   UUID;
BEGIN
  FOR v IN
    SELECT id, owner_id, make, model_name, number
    FROM   "Vehicle"
    WHERE  asset_id IS NULL
  LOOP
    INSERT INTO "Asset" (asset_class, owner_id, display_name, meta_json)
    VALUES (
      'CAB',
      v.owner_id,
      v.make || ' ' || v.model_name || ' (' || v.number || ')',
      jsonb_build_object('vehicle_id', v.id::text, 'number', v.number)
    )
    RETURNING id INTO new_asset;

    UPDATE "Vehicle" SET asset_id = new_asset WHERE id = v.id;
  END LOOP;
END $$;
