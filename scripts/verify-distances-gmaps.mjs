/**
 * Uses Google Maps Distance Matrix API to get verified road distances.
 * Run: node scripts/verify-distances-gmaps.mjs
 *
 * Uses the GOOGLE_MAPS_SERVER_KEY from .env.local
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the API key from .env.local
function loadEnv() {
  const envPath = join(__dirname, "../.env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^GOOGLE_MAPS_SERVER_KEY="?([^"]+)"?/);
    if (m) return m[1].trim();
  }
  throw new Error("GOOGLE_MAPS_SERVER_KEY not found in .env.local");
}

const API_KEY = loadEnv();
const BASE = "https://maps.googleapis.com/maps/api/distancematrix/json";

// Fully-qualified names so Google Maps resolves the right place
const PLACE = {
  "Koraput":           "Koraput, Koraput District, Odisha, India",
  "Jeypore":           "Jeypore, Koraput District, Odisha, India",
  "Semiliguda":        "Semiliguda, Koraput District, Odisha, India",
  "Sunabeda":          "Sunabeda, Koraput District, Odisha, India",
  "Boipariguda":       "Boipariguda, Koraput District, Odisha, India",
  "Damonjodi":         "Damanjodi, Koraput District, Odisha, India",
  "Kundra":            "Kundra, Koraput District, Odisha, India",
  "Narayanpatna":      "Narayanpatna, Koraput District, Odisha, India",
  "Nabarangpur":       "Nabarangpur, Nabarangapur District, Odisha, India",
  "Malkangiri":        "Malkangiri, Malkangiri District, Odisha, India",
  "Rayagada":          "Rayagada, Rayagada District, Odisha, India",
  "Jagdalpur":         "Jagdalpur, Bastar District, Chhattisgarh, India",
  "Vizianagaram":      "Vizianagaram, Andhra Pradesh, India",
  "Visakhapatnam":     "Visakhapatnam, Andhra Pradesh, India",
  "Duduma Falls":      "Duduma Waterfall, Odisha, India",
  "Gupteswar":         "Gupteswar Cave Temple, Koraput, Odisha, India",
  "Deomali":           "Deomali, Koraput District, Odisha, India",
  "Kolab Dam":         "Kolab Dam, Jeypore, Koraput, Odisha, India",
  "Pottangi":          "Pottangi, Koraput District, Odisha, India",
  "Sunabeda Wildlife": "Sunabeda Conservation Reserve, Odisha, India",
};

// All route pairs we need
const PAIRS = [
  // KORAPUT
  ["Koraput", "Jeypore"],
  ["Koraput", "Semiliguda"],
  ["Koraput", "Boipariguda"],
  ["Koraput", "Damonjodi"],
  ["Koraput", "Narayanpatna"],
  ["Koraput", "Sunabeda"],
  ["Koraput", "Nabarangpur"],
  ["Koraput", "Kundra"],
  ["Koraput", "Jagdalpur"],
  ["Koraput", "Malkangiri"],
  ["Koraput", "Rayagada"],
  ["Koraput", "Vizianagaram"],
  ["Koraput", "Visakhapatnam"],
  ["Koraput", "Deomali"],
  ["Koraput", "Gupteswar"],
  ["Koraput", "Duduma Falls"],
  // JEYPORE
  ["Jeypore", "Koraput"],
  ["Jeypore", "Semiliguda"],
  ["Jeypore", "Damonjodi"],
  ["Jeypore", "Kolab Dam"],
  ["Jeypore", "Sunabeda Wildlife"],
  ["Jeypore", "Boipariguda"],
  ["Jeypore", "Narayanpatna"],
  ["Jeypore", "Sunabeda"],
  ["Jeypore", "Nabarangpur"],
  ["Jeypore", "Pottangi"],
  ["Jeypore", "Kundra"],
  ["Jeypore", "Jagdalpur"],
  ["Jeypore", "Malkangiri"],
  ["Jeypore", "Rayagada"],
  ["Jeypore", "Vizianagaram"],
  ["Jeypore", "Visakhapatnam"],
  // SUNABEDA
  ["Sunabeda", "Koraput"],
  ["Sunabeda", "Jeypore"],
  ["Sunabeda", "Jagdalpur"],
  ["Sunabeda", "Malkangiri"],
  ["Sunabeda", "Nabarangpur"],
  ["Sunabeda", "Rayagada"],
  ["Sunabeda", "Visakhapatnam"],
  // RAYAGADA
  ["Rayagada", "Koraput"],
  ["Rayagada", "Jeypore"],
  ["Rayagada", "Sunabeda"],
  ["Rayagada", "Nabarangpur"],
  ["Rayagada", "Malkangiri"],
  ["Rayagada", "Vizianagaram"],
  ["Rayagada", "Visakhapatnam"],
  // NABARANGPUR
  ["Nabarangpur", "Koraput"],
  ["Nabarangpur", "Jeypore"],
  ["Nabarangpur", "Sunabeda"],
  ["Nabarangpur", "Jagdalpur"],
  ["Nabarangpur", "Malkangiri"],
  ["Nabarangpur", "Rayagada"],
  ["Nabarangpur", "Visakhapatnam"],
  // MALKANGIRI
  ["Malkangiri", "Koraput"],
  ["Malkangiri", "Jeypore"],
  ["Malkangiri", "Nabarangpur"],
  ["Malkangiri", "Rayagada"],
  ["Malkangiri", "Visakhapatnam"],
  // JAGDALPUR
  ["Jagdalpur", "Koraput"],
  ["Jagdalpur", "Jeypore"],
  ["Jagdalpur", "Nabarangpur"],
  ["Jagdalpur", "Rayagada"],
  ["Jagdalpur", "Visakhapatnam"],
  // VISAKHAPATNAM
  ["Visakhapatnam", "Koraput"],
  ["Visakhapatnam", "Jeypore"],
  ["Visakhapatnam", "Sunabeda"],
  ["Visakhapatnam", "Rayagada"],
  ["Visakhapatnam", "Nabarangpur"],
  ["Visakhapatnam", "Malkangiri"],
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Batch: 1 origin → up to 10 destinations per API call
async function fetchBatch(origin, destinations) {
  const origStr = encodeURIComponent(PLACE[origin]);
  const destStr = destinations.map((d) => encodeURIComponent(PLACE[d])).join("|");
  const url = `${BASE}?origins=${origStr}&destinations=${destStr}&mode=driving&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error(`API error: ${data.status} — ${data.error_message || ""}`);
  }

  const row = data.rows[0];
  return destinations.map((dest, i) => {
    const el = row.elements[i];
    if (el.status !== "OK") {
      return { from: origin, to: dest, km: null, min: null, error: el.status };
    }
    return {
      from: origin,
      to:   dest,
      km:   Math.round(el.distance.value / 1000),
      min:  Math.round(el.duration.value / 60),
    };
  });
}

async function main() {
  // Group pairs by origin
  const byOrigin = {};
  for (const [from, to] of PAIRS) {
    if (!byOrigin[from]) byOrigin[from] = [];
    byOrigin[from].push(to);
  }

  const results = [];
  const errors  = [];

  for (const [origin, dests] of Object.entries(byOrigin)) {
    // Process in chunks of 10
    for (let i = 0; i < dests.length; i += 10) {
      const chunk = dests.slice(i, i + 10);
      try {
        const batch = await fetchBatch(origin, chunk);
        for (const r of batch) {
          if (r.km === null) {
            errors.push(r);
            console.error(`  ✗  ${r.from} → ${r.to}: ${r.error}`);
          } else {
            results.push(r);
            console.error(`  ✓  ${r.from} → ${r.to}: ${r.km} km  (${r.min} min)`);
          }
        }
      } catch (err) {
        console.error(`  ✗  Batch ${origin} → ${chunk.join(", ")}: ${err.message}`);
        for (const d of chunk) errors.push({ from: origin, to: d, error: err.message });
      }
      await sleep(200);
    }
  }

  if (errors.length) {
    console.error(`\n${errors.length} errors (routes not updated):\n`);
    for (const e of errors) console.error(`  ${e.from} → ${e.to}: ${e.error}`);
  }

  // Print updated RAW array
  console.log("\n\n// === PASTE INTO static-routes.ts ===");
  console.log("const RAW = [");
  let currentFrom = null;
  for (const r of results) {
    if (r.from !== currentFrom) {
      if (currentFrom) console.log();
      console.log(`  // ── ${r.from.toUpperCase()} ──────────────────────────────────────────`);
      currentFrom = r.from;
    }
    const toStr  = `"${r.to}",`;
    const pad    = " ".repeat(Math.max(0, 26 - toStr.length));
    console.log(`  { from: "${r.from}", to: ${toStr}${pad} km: ${r.km}  },`);
  }
  console.log("];");
}

main().catch((e) => { console.error(e); process.exit(1); });
