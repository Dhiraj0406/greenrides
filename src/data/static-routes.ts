// Distances verified via Google Maps Distance Matrix API (June 2025).
// Koraput ↔ Jeypore = 22 km is user-confirmed.
// Pricing: max(₹500, round(km × ₹20 / 25) × 25)

function fare(km: number): number {
  return Math.max(500, Math.round((km * 20) / 25) * 25);
}
function dur(km: number): number {
  return Math.round((km / 45) * 60);
}
function durText(km: number): string {
  const m = dur(km);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const RAW = [
  // ── KORAPUT ───────────────────────────────────────────────────────────────
  { from: "Koraput", to: "Jeypore",           km: 22  }, // user-confirmed & GMaps
  { from: "Koraput", to: "Semiliguda",        km: 22  },
  { from: "Koraput", to: "Sunabeda",          km: 18  },
  { from: "Koraput", to: "Damonjodi",         km: 28  },
  { from: "Koraput", to: "Boipariguda",       km: 45  },
  { from: "Koraput", to: "Kundra",            km: 42  },
  { from: "Koraput", to: "Nabarangpur",       km: 59  },
  { from: "Koraput", to: "Narayanpatna",      km: 80  },
  { from: "Koraput", to: "Deomali",           km: 53  },
  { from: "Koraput", to: "Duduma Falls",      km: 68  },
  { from: "Koraput", to: "Gupteswar",         km: 76  },
  { from: "Koraput", to: "Jagdalpur",         km: 100 },
  { from: "Koraput", to: "Malkangiri",        km: 126 },
  { from: "Koraput", to: "Rayagada",          km: 110 },
  { from: "Koraput", to: "Vizianagaram",      km: 146 },
  { from: "Koraput", to: "Visakhapatnam",     km: 199 },

  // ── JEYPORE ───────────────────────────────────────────────────────────────
  { from: "Jeypore", to: "Koraput",           km: 22  }, // user-confirmed
  { from: "Jeypore", to: "Boipariguda",       km: 21  },
  { from: "Jeypore", to: "Kundra",            km: 20  },
  { from: "Jeypore", to: "Kolab Dam",         km: 14  },
  { from: "Jeypore", to: "Sunabeda",          km: 39  },
  { from: "Jeypore", to: "Sunabeda Wildlife", km: 39  },
  { from: "Jeypore", to: "Damonjodi",         km: 48  },
  { from: "Jeypore", to: "Semiliguda",        km: 42  },
  { from: "Jeypore", to: "Gupteswar",         km: 54  },
  { from: "Jeypore", to: "Nabarangpur",       km: 43  },
  { from: "Jeypore", to: "Pottangi",          km: 68  },
  { from: "Jeypore", to: "Narayanpatna",      km: 101 },
  { from: "Jeypore", to: "Jagdalpur",         km: 85  },
  { from: "Jeypore", to: "Malkangiri",        km: 104 },
  { from: "Jeypore", to: "Rayagada",          km: 131 },
  { from: "Jeypore", to: "Vizianagaram",      km: 167 },
  { from: "Jeypore", to: "Visakhapatnam",     km: 219 },

  // ── SUNABEDA ──────────────────────────────────────────────────────────────
  { from: "Sunabeda", to: "Koraput",          km: 18  },
  { from: "Sunabeda", to: "Jeypore",          km: 40  },
  { from: "Sunabeda", to: "Nabarangpur",      km: 77  },
  { from: "Sunabeda", to: "Jagdalpur",        km: 118 },
  { from: "Sunabeda", to: "Malkangiri",       km: 144 },
  { from: "Sunabeda", to: "Rayagada",         km: 118 },
  { from: "Sunabeda", to: "Visakhapatnam",    km: 180 },

  // ── RAYAGADA ──────────────────────────────────────────────────────────────
  { from: "Rayagada", to: "Koraput",          km: 110 },
  { from: "Rayagada", to: "Jeypore",          km: 132 },
  { from: "Rayagada", to: "Sunabeda",         km: 118 },
  { from: "Rayagada", to: "Nabarangpur",      km: 168 },
  { from: "Rayagada", to: "Malkangiri",       km: 236 },
  { from: "Rayagada", to: "Vizianagaram",     km: 136 },
  { from: "Rayagada", to: "Visakhapatnam",    km: 189 },

  // ── NABARANGPUR ───────────────────────────────────────────────────────────
  { from: "Nabarangpur", to: "Koraput",       km: 59  },
  { from: "Nabarangpur", to: "Jeypore",       km: 43  },
  { from: "Nabarangpur", to: "Sunabeda",      km: 77  },
  { from: "Nabarangpur", to: "Jagdalpur",     km: 72  },
  { from: "Nabarangpur", to: "Malkangiri",    km: 145 },
  { from: "Nabarangpur", to: "Rayagada",      km: 168 },
  { from: "Nabarangpur", to: "Visakhapatnam", km: 257 },

  // ── MALKANGIRI ────────────────────────────────────────────────────────────
  { from: "Malkangiri", to: "Koraput",        km: 126 },
  { from: "Malkangiri", to: "Jeypore",        km: 104 },
  { from: "Malkangiri", to: "Nabarangpur",    km: 145 },
  { from: "Malkangiri", to: "Rayagada",       km: 236 },
  { from: "Malkangiri", to: "Visakhapatnam",  km: 292 },

  // ── JAGDALPUR (Chhattisgarh) ──────────────────────────────────────────────
  { from: "Jagdalpur", to: "Koraput",         km: 101 },
  { from: "Jagdalpur", to: "Jeypore",         km: 85  },
  { from: "Jagdalpur", to: "Nabarangpur",     km: 71  },
  { from: "Jagdalpur", to: "Rayagada",        km: 210 },
  { from: "Jagdalpur", to: "Visakhapatnam",   km: 299 },

  // ── VISAKHAPATNAM (Andhra Pradesh) ────────────────────────────────────────
  { from: "Visakhapatnam", to: "Koraput",     km: 199 },
  { from: "Visakhapatnam", to: "Jeypore",     km: 212 },
  { from: "Visakhapatnam", to: "Sunabeda",    km: 180 },
  { from: "Visakhapatnam", to: "Rayagada",    km: 189 },
  { from: "Visakhapatnam", to: "Nabarangpur", km: 257 },
  { from: "Visakhapatnam", to: "Malkangiri",  km: 292 },
];

export const STATIC_ROUTES = RAW.map((r) => ({
  from_city:      r.from,
  to_city:        r.to,
  distance_km:    r.km,
  duration_min:   dur(r.km),
  duration_text:  durText(r.km),
  fare_paise:     fare(r.km) * 100,
  fare_rupees:    fare(r.km),
  discount_pct:   0,
  discount_label: undefined as string | undefined,
}));

// Unique place names across all routes — used for autocomplete
export const ALL_PLACES = [...new Set([
  ...RAW.map((r) => r.from),
  ...RAW.map((r) => r.to),
])].sort();
