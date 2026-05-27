// Must be set before any TLS connection is established
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter } as never);

// Pricing formula: max(₹500, round(km × ₹20 / 25) × 25)
// Calibrated: 22km = ₹500 (min), 195km = ₹3900 (Vizag range)
function fare(km: number): number {
  return Math.max(50000, Math.round((km * 20) / 25) * 2500);
}

// Duration estimate: hill roads average ~45 km/h
function dur(km: number): number {
  return Math.round((km / 45) * 60);
}

// Distances are road distances (Google Maps). User-confirmed: Jeypore↔Koraput = 22km.
const ROUTES = [
  // ── KORAPUT origins ──────────────────────────────────────────────────────
  { from: "Koraput", to: "Jeypore",           km: 22  },
  { from: "Koraput", to: "Semiliguda",        km: 18  },
  { from: "Koraput", to: "Sunabeda",          km: 42  },
  { from: "Koraput", to: "Boipariguda",       km: 30  },
  { from: "Koraput", to: "Damonjodi",         km: 50  },
  { from: "Koraput", to: "Kundra",            km: 35  },
  { from: "Koraput", to: "Narayanpatna",      km: 55  },
  { from: "Koraput", to: "Nabarangpur",       km: 80  },
  { from: "Koraput", to: "Malkangiri",        km: 135 },
  { from: "Koraput", to: "Rayagada",          km: 148 },
  { from: "Koraput", to: "Jagdalpur",         km: 190 },
  { from: "Koraput", to: "Vizianagaram",      km: 185 },
  { from: "Koraput", to: "Visakhapatnam",     km: 220 },
  { from: "Koraput", to: "Duduma Falls",      km: 52  },
  { from: "Koraput", to: "Gupteswar",         km: 60  },
  { from: "Koraput", to: "Deomali",           km: 45  },

  // ── JEYPORE origins ──────────────────────────────────────────────────────
  { from: "Jeypore", to: "Koraput",           km: 22  },
  { from: "Jeypore", to: "Semiliguda",        km: 50  },
  { from: "Jeypore", to: "Sunabeda",          km: 28  },
  { from: "Jeypore", to: "Boipariguda",       km: 38  },
  { from: "Jeypore", to: "Damonjodi",         km: 58  },
  { from: "Jeypore", to: "Kundra",            km: 45  },
  { from: "Jeypore", to: "Narayanpatna",      km: 72  },
  { from: "Jeypore", to: "Nabarangpur",       km: 95  },
  { from: "Jeypore", to: "Malkangiri",        km: 145 },
  { from: "Jeypore", to: "Rayagada",          km: 112 },
  { from: "Jeypore", to: "Jagdalpur",         km: 160 },
  { from: "Jeypore", to: "Vizianagaram",      km: 165 },
  { from: "Jeypore", to: "Visakhapatnam",     km: 195 },
  { from: "Jeypore", to: "Kolab Dam",         km: 18  },
  { from: "Jeypore", to: "Pottangi",          km: 65  },
  { from: "Jeypore", to: "Sunabeda Wildlife", km: 28  },

  // ── SUNABEDA origins ─────────────────────────────────────────────────────
  { from: "Sunabeda", to: "Koraput",          km: 42  },
  { from: "Sunabeda", to: "Jeypore",          km: 28  },
  { from: "Sunabeda", to: "Nabarangpur",      km: 55  },
  { from: "Sunabeda", to: "Rayagada",         km: 110 },
  { from: "Sunabeda", to: "Malkangiri",       km: 120 },
  { from: "Sunabeda", to: "Jagdalpur",        km: 165 },
  { from: "Sunabeda", to: "Visakhapatnam",    km: 175 },

  // ── RAYAGADA origins ─────────────────────────────────────────────────────
  { from: "Rayagada", to: "Koraput",          km: 148 },
  { from: "Rayagada", to: "Jeypore",          km: 112 },
  { from: "Rayagada", to: "Sunabeda",         km: 110 },
  { from: "Rayagada", to: "Nabarangpur",      km: 95  },
  { from: "Rayagada", to: "Malkangiri",       km: 195 },
  { from: "Rayagada", to: "Visakhapatnam",    km: 200 },
  { from: "Rayagada", to: "Vizianagaram",     km: 130 },

  // ── NABARANGPUR origins ──────────────────────────────────────────────────
  { from: "Nabarangpur", to: "Koraput",       km: 80  },
  { from: "Nabarangpur", to: "Jeypore",       km: 95  },
  { from: "Nabarangpur", to: "Sunabeda",      km: 55  },
  { from: "Nabarangpur", to: "Rayagada",      km: 95  },
  { from: "Nabarangpur", to: "Malkangiri",    km: 130 },
  { from: "Nabarangpur", to: "Jagdalpur",     km: 115 },
  { from: "Nabarangpur", to: "Visakhapatnam", km: 230 },

  // ── MALKANGIRI origins ───────────────────────────────────────────────────
  { from: "Malkangiri", to: "Koraput",        km: 135 },
  { from: "Malkangiri", to: "Jeypore",        km: 145 },
  { from: "Malkangiri", to: "Rayagada",       km: 195 },
  { from: "Malkangiri", to: "Nabarangpur",    km: 130 },
  { from: "Malkangiri", to: "Visakhapatnam",  km: 290 },

  // ── JAGDALPUR origins ────────────────────────────────────────────────────
  { from: "Jagdalpur", to: "Koraput",         km: 190 },
  { from: "Jagdalpur", to: "Jeypore",         km: 160 },
  { from: "Jagdalpur", to: "Nabarangpur",     km: 115 },
  { from: "Jagdalpur", to: "Rayagada",        km: 245 },
  { from: "Jagdalpur", to: "Visakhapatnam",   km: 310 },

  // ── VISAKHAPATNAM origins ────────────────────────────────────────────────
  { from: "Visakhapatnam", to: "Koraput",     km: 220 },
  { from: "Visakhapatnam", to: "Jeypore",     km: 195 },
  { from: "Visakhapatnam", to: "Sunabeda",    km: 175 },
  { from: "Visakhapatnam", to: "Rayagada",    km: 200 },
  { from: "Visakhapatnam", to: "Nabarangpur", km: 230 },
  { from: "Visakhapatnam", to: "Malkangiri",  km: 290 },
];

async function main() {
  console.log("Seeding routes (formula: max(₹500, round(km×₹20/25)×25))…");
  await prisma.$executeRawUnsafe("SET row_security = off");

  for (const r of ROUTES) {
    const f = fare(r.km);
    const m = dur(r.km);
    await prisma.routeConfig.upsert({
      where:  { from_city_to_city: { from_city: r.from, to_city: r.to } },
      update: { distance_km: r.km, duration_min: m, base_fare: f },
      create: { from_city: r.from, to_city: r.to, distance_km: r.km, duration_min: m, base_fare: f, is_active: true },
    });
    console.log(`  ✓ ${r.from} → ${r.to}  ${r.km}km  ₹${f / 100}`);
  }

  console.log(`\nSeeded ${ROUTES.length} routes.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
