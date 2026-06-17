"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Car, MapPin, Gauge, Fuel, Search } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";

interface Listing {
  id:           string;
  make:         string;
  model:        string;
  year:         number;
  price_paise:  string;
  mileage_km:   number | null;
  fuel_type:    string;
  transmission: string;
  location:     string;
  photos:       string[];
  status:       string;
}

function formatPrice(paise: string): string {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export default function UsedCarsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [make, setMake]         = useState("");
  const [fuelType, setFuelType] = useState("");

  const LIMIT = 12;

  async function load(p: number, reset = false) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (make)     qs.set("make", make);
      if (fuelType) qs.set("fuel_type", fuelType);
      const res  = await fetch(`/api/used-cars/listings?${qs}`);
      const json = await res.json();
      setListings((prev) => reset ? (json.data ?? []) : [...prev, ...(json.data ?? [])]);
      setTotal(json.total ?? 0);
      setPage(p);
    } catch { /* silent — listings remain as-is */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(1, true); }, [make, fuelType]); // eslint-disable-line react-hooks/exhaustive-deps

  const FUEL_OPTIONS = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"];

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-lime/60 text-xs font-mono uppercase tracking-widest mb-1">Green</p>
            <h1 className="font-display text-2xl text-white">Used Cars</h1>
          </div>
          <Link href="/used-cars/sell"
            className="bg-lime/20 border border-lime/40 text-lime text-xs font-semibold px-3 py-2 rounded-xl">
            + Sell your car
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-sub flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by make (e.g. Maruti)"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="text-sm text-text placeholder:text-sub flex-1 outline-none bg-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["", ...FUEL_OPTIONS].map((f) => (
            <button
              key={f}
              onClick={() => setFuelType(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                ${fuelType === f ? "bg-forest text-white" : "bg-white border border-border text-sub"}`}
            >
              {f || "All fuel"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-4">
        {loading && listings.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No listings found.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {listings.map((l) => (
            <Link key={l.id} href={`/used-cars/${l.id}`}
              className="bg-white border border-border rounded-2xl overflow-hidden hover:border-leaf/50 transition-colors">
              <div className="relative">
                {l.photos.length > 0 ? (
                  <img
                    src={l.photos[0]}
                    alt={`${l.make} ${l.model}`}
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-warm flex items-center justify-center">
                    <Car className="w-8 h-8 text-sub" />
                  </div>
                )}
                {l.status === "SOLD" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-bold bg-red-500 px-2 py-1 rounded-full">SOLD</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-display text-base text-forest leading-tight">
                  {l.make} {l.model}
                </p>
                <p className="text-xs text-sub mb-2">{l.year}</p>
                <p className="font-semibold text-sm text-leaf mb-2">{formatPrice(l.price_paise)}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="flex items-center gap-0.5 text-[10px] text-sub bg-warm px-1.5 py-0.5 rounded-full">
                    <MapPin className="w-2.5 h-2.5" />{l.location}
                  </span>
                  {l.mileage_km && (
                    <span className="flex items-center gap-0.5 text-[10px] text-sub bg-warm px-1.5 py-0.5 rounded-full">
                      <Gauge className="w-2.5 h-2.5" />{l.mileage_km.toLocaleString("en-IN")} km
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-[10px] text-sub bg-warm px-1.5 py-0.5 rounded-full">
                    <Fuel className="w-2.5 h-2.5" />{l.fuel_type.charAt(0) + l.fuel_type.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && listings.length < total && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => load(page + 1)}
              className="bg-white border border-border text-sm font-semibold text-text px-6 py-2.5 rounded-2xl"
            >
              Load more
            </button>
          </div>
        )}

        {loading && listings.length > 0 && (
          <div className="flex justify-center mt-4">
            <Loader2 className="w-5 h-5 animate-spin text-leaf" />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
