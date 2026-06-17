process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: "postgresql://postgres:Babul%40123456%26%26@db.eifaoksysbquyhaowlev.supabase.co:5432/postgres", ssl: { rejectUnauthorized: false } });
async function main() {
  await c.connect();
  const { rows } = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'RideRequest_preferred_time_check'`
  );
  console.log("Constraint:", rows[0]?.def ?? "not found");
  await c.end();
}
main().catch(console.error);
