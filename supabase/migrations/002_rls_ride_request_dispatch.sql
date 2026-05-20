-- RLS for RideRequest and DriverDispatch tables
-- Apply in Supabase SQL editor after 001_rls_policies.sql

ALTER TABLE "RideRequest"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriverDispatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramCode"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminLog"       ENABLE ROW LEVEL SECURITY;

-- Riders see only their own requests
CREATE POLICY "ride_requests_own_rider" ON "RideRequest"
  FOR ALL USING (auth.uid()::text = rider_id);

-- Drivers see dispatches assigned to them
CREATE POLICY "driver_dispatch_own" ON "DriverDispatch"
  FOR SELECT USING (auth.uid()::text = driver_id);

-- Drivers can update their own dispatches (accept/reject)
CREATE POLICY "driver_dispatch_update_own" ON "DriverDispatch"
  FOR UPDATE USING (auth.uid()::text = driver_id);

-- TelegramCode: no direct client access (server-only via service role)
-- AdminLog: no direct client access (server-only via service role)
