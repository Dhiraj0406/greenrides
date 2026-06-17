// Seed: dummy fleet owner + vehicles
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import pg from "pg";
const { Client } = pg;

const DB_URL =
  "postgresql://postgres:Babul%40123456%26%26@db.eifaoksysbquyhaowlev.supabase.co:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("SET row_security = off");

  const PHONE  = "+919000000002";
  const NAME   = "Ramesh Nayak";
  const EMAIL  = "ramesh@greenrides.co.in";

  // ── 1. User ────────────────────────────────────────────────────────────────
  const { rows: [user] } = await client.query<{ id: string }>(
    `INSERT INTO "User" (id, phone, name, email, role, is_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'OWNER', true, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET name = $2, role = 'OWNER'
     RETURNING id`,
    [PHONE, NAME, EMAIL]
  );
  console.log("✓ User (Owner):", user.id, PHONE);

  // ── 2. Owner record ────────────────────────────────────────────────────────
  const { rows: [owner] } = await client.query<{ id: string }>(
    `INSERT INTO "Owner" (id, user_id, name, phone, email, status, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE', NOW())
     ON CONFLICT (user_id) DO UPDATE SET name = $2, status = 'ACTIVE'
     RETURNING id`,
    [user.id, NAME, "9000000002", EMAIL]
  );
  console.log("✓ Owner:", owner.id);

  // ── 3. Vehicles ────────────────────────────────────────────────────────────
  const vehicles = [
    { make: "Maruti",  model_name: "Swift Dzire",   number: "OD05XY1234", seats: 4 },
    { make: "Toyota",  model_name: "Innova Crysta",  number: "OD05AB5678", seats: 7 },
    { make: "Mahindra",model_name: "Bolero",          number: "OD05CD9012", seats: 6 },
  ];

  for (const v of vehicles) {
    const { rows: [{ id }] } = await client.query<{ id: string }>(
      `INSERT INTO "Vehicle" (id, owner_id, make, model_name, number, seats, active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW())
       ON CONFLICT (number) DO UPDATE SET owner_id = $1, make = $2, model_name = $3, seats = $5
       RETURNING id`,
      [owner.id, v.make, v.model_name, v.number, v.seats]
    );
    console.log(`✓ Vehicle: ${v.make} ${v.model_name}  ${v.number}  id:${id}`);
  }

  // ── 4. Link existing driver (Arjun Patel) to this owner ────────────────────
  await client.query(
    `UPDATE "DriverProfile" SET owner_id = $1
     WHERE user_id = (SELECT id FROM "User" WHERE phone = '+919000000001' LIMIT 1)`,
    [owner.id]
  );
  console.log("✓ Linked driver 9000000001 (Arjun Patel) to fleet owner");

  await client.end();

  console.log(`
╔══════════════════════════════════════════════════════╗
║              FLEET OWNER CREDENTIALS                 ║
╠══════════════════════════════════════════════════════╣
║  Portal URL : fleet.greenrides.co.in                 ║
║  Phone      : 9000000002                             ║
║  OTP        : 000000                                 ║
║  Name       : Ramesh Nayak                           ║
╠══════════════════════════════════════════════════════╣
║  Vehicles:                                           ║
║    • Maruti Swift Dzire      OD05XY1234  (4 seats)   ║
║    • Toyota Innova Crysta    OD05AB5678  (7 seats)   ║
║    • Mahindra Bolero         OD05CD9012  (6 seats)   ║
║  Driver: Arjun Patel (9000000001)                    ║
╚══════════════════════════════════════════════════════╝
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
