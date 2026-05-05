-- Row Level Security policies for Green rides platform
-- Apply these in your Supabase SQL editor after running prisma migrate

ALTER TABLE "Ride"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RouteConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FareRule"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriverProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rating"      ENABLE ROW LEVEL SECURITY;

-- Public can read scheduled rides
CREATE POLICY "rides_public_read" ON "Ride"
  FOR SELECT USING (status = 'SCHEDULED');

-- Drivers manage their own rides
CREATE POLICY "rides_own_driver" ON "Ride"
  FOR ALL USING (auth.uid()::text = driver_id);

-- Riders manage their own bookings
CREATE POLICY "bookings_own_rider" ON "Booking"
  FOR ALL USING (auth.uid()::text = rider_id);

-- Drivers can see bookings on their rides
CREATE POLICY "bookings_own_driver" ON "Booking"
  FOR SELECT USING (
    ride_id IN (SELECT id FROM "Ride" WHERE driver_id = auth.uid()::text)
  );

-- Riders see their own payments
CREATE POLICY "payments_own" ON "Payment"
  FOR SELECT USING (
    booking_id IN (SELECT id FROM "Booking" WHERE rider_id = auth.uid()::text)
  );

-- Public can read active routes
CREATE POLICY "routes_public_read" ON "RouteConfig"
  FOR SELECT USING (is_active = true);

-- Public can read fare rules for active routes
CREATE POLICY "fare_rules_public_read" ON "FareRule"
  FOR SELECT USING (
    route_id IN (SELECT id FROM "RouteConfig" WHERE is_active = true)
  );

-- Users manage their own profile
CREATE POLICY "users_own" ON "User"
  FOR ALL USING (auth.uid()::text = id);

-- Driver profiles: read own, public can read approved
CREATE POLICY "driver_profile_own" ON "DriverProfile"
  FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "driver_profile_public_read" ON "DriverProfile"
  FOR SELECT USING (is_approved = true);

-- Ratings: raters and rated can see their ratings
CREATE POLICY "ratings_own" ON "Rating"
  FOR SELECT USING (
    auth.uid()::text = rater_id OR auth.uid()::text = rated_id
  );

CREATE POLICY "ratings_insert_own" ON "Rating"
  FOR INSERT WITH CHECK (auth.uid()::text = rater_id);

-- ── Supabase function for atomic seat booking ──────────────────────────────
CREATE OR REPLACE FUNCTION create_booking(
  p_ride_id  UUID,
  p_rider_id UUID,
  p_seats    INT,
  p_pickup   TEXT
) RETURNS JSON AS $$
DECLARE
  v_available INT;
  v_fare      INT;
  v_booking_id UUID;
BEGIN
  -- Lock the ride row
  SELECT available_seats, fare_paise
    INTO v_available, v_fare
    FROM "Ride"
   WHERE id = p_ride_id
     AND status = 'SCHEDULED'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found or not available';
  END IF;

  IF v_available < p_seats THEN
    RAISE EXCEPTION 'Not enough seats available';
  END IF;

  UPDATE "Ride"
     SET available_seats = available_seats - p_seats,
         updated_at      = now()
   WHERE id = p_ride_id;

  INSERT INTO "Booking" (ride_id, rider_id, seats, pickup_point, amount_paise, status)
  VALUES (p_ride_id, p_rider_id, p_seats, p_pickup, v_fare * p_seats, 'PENDING')
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'booking_id',   v_booking_id,
    'amount_paise', v_fare * p_seats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
