-- Add per-driver commission percentage (platform fee)
-- Default 10% platform cut. Admin can override per driver.
ALTER TABLE "DriverProfile" ADD COLUMN IF NOT EXISTS commission_pct FLOAT NOT NULL DEFAULT 10.0;
