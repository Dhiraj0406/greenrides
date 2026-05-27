-- Phase 5: Live driver location tracking.

CREATE TABLE IF NOT EXISTS "DriverLocation" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT        UNIQUE NOT NULL,
  driver_id   TEXT        NOT NULL,
  lat         FLOAT8      NOT NULL,
  lng         FLOAT8      NOT NULL,
  heading     FLOAT4,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DriverLocation_driver_idx"  ON "DriverLocation" (driver_id);

ALTER TABLE "DriverLocation" ENABLE ROW LEVEL SECURITY;

-- Driver can write their own row
CREATE POLICY IF NOT EXISTS "location_driver_write" ON "DriverLocation"
  FOR ALL
  USING   (driver_id = auth.uid()::text)
  WITH CHECK (driver_id = auth.uid()::text);

-- Rider can read the location for their own request
CREATE POLICY IF NOT EXISTS "location_rider_read" ON "DriverLocation"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "RideRequest"
      WHERE id = request_id
        AND rider_id = auth.uid()::text
    )
  );

-- Enable Realtime publication so Supabase broadcasts row changes
ALTER PUBLICATION supabase_realtime ADD TABLE "DriverLocation";
