-- RLS policies for fleet tables
-- All fleet tables sit in the public schema and are exposed via the Data API,
-- so RLS must be enabled and explicit policies created.

-- ── Owner ────────────────────────────────────────────────────────────────────
ALTER TABLE "Owner" ENABLE ROW LEVEL SECURITY;

-- Owners can read their own record
CREATE POLICY "owner_select_own" ON "Owner"
  FOR SELECT USING (user_id = auth.uid()::text);

-- Service role (admin client) manages inserts/updates
CREATE POLICY "owner_insert_service" ON "Owner"
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "owner_update_service" ON "Owner"
  FOR UPDATE USING (auth.role() = 'service_role');

-- ── Vehicle ──────────────────────────────────────────────────────────────────
ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;

-- Owner can read vehicles they own
CREATE POLICY "vehicle_select_owner" ON "Vehicle"
  FOR SELECT USING (
    owner_id IN (SELECT id FROM "Owner" WHERE user_id = auth.uid()::text)
  );

-- Assigned driver can read their vehicle
CREATE POLICY "vehicle_select_driver" ON "Vehicle"
  FOR SELECT USING (
    driver_id IN (SELECT id FROM "DriverProfile" WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "vehicle_insert_service" ON "Vehicle"
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "vehicle_update_service" ON "Vehicle"
  FOR UPDATE USING (auth.role() = 'service_role');

-- ── Notification ─────────────────────────────────────────────────────────────
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

-- Users read only their own notifications
CREATE POLICY "notification_select_own" ON "Notification"
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "notification_update_own" ON "Notification"
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "notification_insert_service" ON "Notification"
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── OwnerPayout ──────────────────────────────────────────────────────────────
ALTER TABLE "OwnerPayout" ENABLE ROW LEVEL SECURITY;

-- Owner can read their own payouts
CREATE POLICY "payout_select_owner" ON "OwnerPayout"
  FOR SELECT USING (
    owner_id IN (SELECT id FROM "Owner" WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "payout_insert_service" ON "OwnerPayout"
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "payout_update_service" ON "OwnerPayout"
  FOR UPDATE USING (auth.role() = 'service_role');
