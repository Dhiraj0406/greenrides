// Demo data: rides + a ride request for testing the full flow
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import pg from "pg";
const { Client } = pg;

const DB_URL =
  "postgresql://postgres:Babul%40123456%26%26@db.eifaoksysbquyhaowlev.supabase.co:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("SET row_security = off");

  // Get driver user id
  const { rows: [driver] } = await client.query<{ id: string }>(
    `SELECT id FROM "User" WHERE phone = '+919000000001' LIMIT 1`
  );
  if (!driver) { console.error("Driver not found — run seed-dummy.ts first"); process.exit(1); }
  console.log("Driver ID:", driver.id);

  // ── Rides posted by the driver ──────────────────────────────────────────────
  const tomorrow  = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const day2      = new Date(); day2.setDate(day2.getDate() + 2);
  const day3      = new Date(); day3.setDate(day3.getDate() + 3);

  function dt(base: Date, h: number, m = 0) {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  const rides = [
    {
      from_city:      "Koraput",
      to_city:        "Jeypore",
      departure_time: dt(tomorrow, 7, 30),
      total_seats:    4,
      fare_paise:     50000,   // ₹500
      pickup_points:  ["Koraput Bus Stand", "Circuit House"],
    },
    {
      from_city:      "Jeypore",
      to_city:        "Visakhapatnam",
      departure_time: dt(day2, 5, 0),
      total_seats:    4,
      fare_paise:     390000,  // ₹3900
      pickup_points:  ["Jeypore Bus Stand", "NAC Colony"],
    },
    {
      from_city:      "Koraput",
      to_city:        "Visakhapatnam",
      departure_time: dt(day3, 6, 0),
      total_seats:    4,
      fare_paise:     440000,  // ₹4400
      pickup_points:  ["Koraput Bus Stand"],
    },
  ];

  for (const r of rides) {
    const { rows: [{ id }] } = await client.query<{ id: string }>(
      `INSERT INTO "Ride"
         (id, driver_id, from_city, to_city, departure_time, total_seats,
          available_seats, fare_paise, pickup_points, status, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $5, $6, $7, 'SCHEDULED', NOW(), NOW())
       RETURNING id`,
      [driver.id, r.from_city, r.to_city, r.departure_time,
       r.total_seats, r.fare_paise, r.pickup_points]
    );
    console.log(`✓ Ride ${r.from_city} → ${r.to_city}  ₹${r.fare_paise / 100}  id:${id}`);
  }

  // ── Dummy rider + ride request ───────────────────────────────────────────────
  const riderPhone = "+919876543210";
  const { rows: [rider] } = await client.query<{ id: string }>(
    `INSERT INTO "User" (id, phone, name, role, is_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'Priya Sharma', 'RIDER', true, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET name = 'Priya Sharma'
     RETURNING id`,
    [riderPhone]
  );
  console.log("✓ Rider:", rider.id, riderPhone);

  const travelDate = new Date(tomorrow);
  travelDate.setHours(0, 0, 0, 0);
  await client.query(
    `INSERT INTO "RideRequest"
       (id, rider_id, rider_phone, from_city, to_city, fare_paise, travel_date,
        preferred_time, status, notes, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, $2, 'Koraput', 'Rayagada', 296000, $3,
        'MORNING', 'PENDING', 'Window seat preferred', NOW(), NOW())`,
    [rider.id, riderPhone.replace("+91", ""), travelDate.toISOString()]
  );
  console.log("✓ RideRequest: Koraput → Rayagada  ₹2960  (PENDING dispatch)");

  await client.end();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    DEMO DATA ADDED                        ║
╠═══════════════════════════════════════════════════════════╣
║  3 rides posted by Arjun Patel (driver 9000000001):       ║
║    • Koraput → Jeypore        ₹500   tomorrow 7:30 AM     ║
║    • Jeypore → Visakhapatnam  ₹3900  day+2   5:00 AM      ║
║    • Koraput → Visakhapatnam  ₹4400  day+3   6:00 AM      ║
║                                                           ║
║  1 pending ride request (Priya Sharma):                   ║
║    • Koraput → Rayagada  ₹2960  (visible in admin panel)  ║
╚═══════════════════════════════════════════════════════════╝
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
