-- ── CarListing ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CarListing" (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  make         TEXT        NOT NULL,
  model        TEXT        NOT NULL,
  year         INT         NOT NULL,
  price_paise  BIGINT      NOT NULL,
  mileage_km   INT,
  fuel_type    TEXT        NOT NULL,
  transmission TEXT        NOT NULL,
  location     TEXT        NOT NULL,
  description  TEXT,
  seller_name  TEXT        NOT NULL,
  seller_phone TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'PENDING',
  photos       TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_listing_status ON "CarListing"(status);
CREATE INDEX IF NOT EXISTS idx_car_listing_make   ON "CarListing"(make);

ALTER TABLE "CarListing" ENABLE ROW LEVEL SECURITY;

-- Public can read APPROVED and SOLD listings
CREATE POLICY "car_listing_public_read" ON "CarListing"
  FOR SELECT
  USING (status IN ('APPROVED', 'SOLD'));

-- Anyone can submit a new listing (always goes to PENDING)
CREATE POLICY "car_listing_public_insert" ON "CarListing"
  FOR INSERT
  WITH CHECK (status = 'PENDING');

-- ── CarInquiry ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CarInquiry" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID        NOT NULL REFERENCES "CarListing"(id) ON DELETE CASCADE,
  buyer_name  TEXT        NOT NULL,
  buyer_phone TEXT        NOT NULL,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_inquiry_listing ON "CarInquiry"(listing_id);

ALTER TABLE "CarInquiry" ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
CREATE POLICY "car_inquiry_public_insert" ON "CarInquiry"
  FOR INSERT
  WITH CHECK (true);

-- No public SELECT — admin reads via service role (bypasses RLS)

-- ── Supabase Storage bucket ───────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('used-car-photos', 'used-car-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ── Remote config flag ────────────────────────────────────
INSERT INTO "app_remote_config" (key, module_scope, enabled, value_json)
VALUES ('used_cars.module_enabled', 'USED_CARS'::"ModuleScope", false, '{}')
ON CONFLICT (key) DO NOTHING;
