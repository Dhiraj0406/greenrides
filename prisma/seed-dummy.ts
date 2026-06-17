// One-time script: creates dummy driver for demo
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import pg from "pg";

const { Client } = pg;

const DB_URL =
  "postgresql://postgres:Babul%40123456%26%26@db.eifaoksysbquyhaowlev.supabase.co:5432/postgres";

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("SET row_security = off");

  // Check what columns DriverProfile actually has in the DB
  const { rows: cols } = await client.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'DriverProfile'
     ORDER BY ordinal_position`
  );
  const colNames = cols.map((c) => c.column_name);
  console.log("DriverProfile columns in DB:", colNames.join(", "));

  const PHONE = "+919000000001";
  const NAME  = "Arjun Patel";

  // ── 1. User (upsert by phone) ──────────────────────────────────────────
  const userRes = await client.query<{ id: string }>(
    `INSERT INTO "User" (id, phone, name, role, is_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'DRIVER', true, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET name = $2, role = 'DRIVER', updated_at = NOW()
     RETURNING id`,
    [PHONE, NAME]
  );
  const userId = userRes.rows[0].id;
  console.log("✓ User:", userId, PHONE);

  // ── 2. DriverProfile (upsert by user_id) ──────────────────────────────
  // Build dynamic column list based on what the DB actually has
  const baseFields = {
    user_id:        userId,
    vehicle_type:   "CAB",
    vehicle_number: "OD05XY1234",
    vehicle_model:  "Maruti Swift Dzire",
    license_number: "OD142000012345",
    is_approved:    true,
    avg_rating:     4.8,
    total_trips:    12,
  };

  const extraFields: Record<string, unknown> = {};
  if (colNames.includes("approved_at"))    extraFields.approved_at    = new Date().toISOString();
  if (colNames.includes("kyc_status"))     extraFields.kyc_status     = "APPROVED";
  if (colNames.includes("is_online"))      extraFields.is_online      = false;

  const allFields = { ...baseFields, ...extraFields };
  const keys   = Object.keys(allFields);
  const values = Object.values(allFields);
  const insertCols   = keys.join(", ");
  const insertPlaces = keys.map((_, i) => `$${i + 1}`).join(", ");
  const updatePairs  = keys
    .filter((k) => k !== "user_id")
    .map((k) => `${k} = EXCLUDED.${k}`)
    .join(", ");

  const profileRes = await client.query<{ id: string }>(
    `INSERT INTO "DriverProfile" (id, ${insertCols})
     VALUES (gen_random_uuid(), ${insertPlaces})
     ON CONFLICT (user_id) DO UPDATE SET ${updatePairs}
     RETURNING id`,
    values
  );
  const profileId = profileRes.rows[0].id;
  console.log("✓ DriverProfile:", profileId);

  await client.end();

  console.log(`
╔══════════════════════════════════════════════════╗
║              DUMMY DRIVER CREDENTIALS            ║
╠══════════════════════════════════════════════════╣
║  Portal URL : driver.greenrides.co.in            ║
║  Phone      : 9000000001                         ║
║  OTP        : 000000                             ║
║  Name       : Arjun Patel                        ║
║  Vehicle    : Maruti Swift Dzire · OD05XY1234    ║
╚══════════════════════════════════════════════════╝
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
