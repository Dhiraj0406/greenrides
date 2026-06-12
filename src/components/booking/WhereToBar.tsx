"use client";

import { useEffect, useRef, useState } from "react";
import { Search, MapPin, ArrowLeft, Clock, X, ChevronRight } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration, cn } from "@/lib/utils";
import type { RouteInfo } from "@/types";

const RECENT_KEY = "green_recent_trips";

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}
function saveRecent(city: string) {
  try {
    const prev = getRecent().filter((c) => c !== city);
    localStorage.setItem(RECENT_KEY, JSON.stringify([city, ...prev].slice(0, 5)));
  } catch {}
}

interface Props { initialRoutes: RouteInfo[] }

export function WhereToBar({ initialRoutes }: Props) {
  const { origin, destination, setOrigin, setDestination, setRouteData, setDiscount } =
    useBookingStore();

  const [allRoutes, setAllRoutes] = useState<RouteInfo[]>(initialRoutes);
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState("");
  const [recent, setRecent]       = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh all routes in background (catches any additions since SSR)
  useEffect(() => {
    fetch("/api/routes")
      .then((r) => r.json())
      .then((j) => { if (j.data?.length) setAllRoutes(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { setRecent(getRecent()); }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function selectRoute(route: RouteInfo) {
    if (route.from_city !== origin) setOrigin(route.from_city);
    setDestination(route.to_city);
    setRouteData({ km: route.distance_km, min: route.duration_min, text: route.duration_text, fare: route.fare_rupees });
    setDiscount(0, route.discount_label ?? "");
    track.destinationSelected(route.from_city, route.to_city, route.fare_rupees);
    saveRecent(route.to_city);
    setOpen(false);
    setTimeout(() => document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  // Search logic: deduplicate destinations, current origin first
  const trimmed = query.trim().toLowerCase();
  const searchResults = (() => {
    if (trimmed.length === 0) return [];
    const matches = allRoutes.filter((r) => r.to_city.toLowerCase().includes(trimmed));
    const sorted = [...matches].sort((a, b) =>
      a.from_city === origin ? -1 : b.from_city === origin ? 1 : 0
    );
    const seen = new Set<string>();
    return sorted.filter((r) => !seen.has(r.to_city) && seen.add(r.to_city));
  })();

  const popularRoutes = allRoutes.filter((r) => r.from_city === (origin ?? "Koraput")).slice(0, 6);

  const recentRoutes = recent
    .map((city) => allRoutes.find((r) => r.to_city === city && r.from_city === (origin ?? "Koraput")))
    .filter(Boolean) as RouteInfo[];

  return (
    <>
      {/* ── "Where to?" bar ─────────────────────────────────── */}
      <div className="px-4 mt-5">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 bg-white border border-border rounded-2xl
                     px-4 py-4 text-left shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-xl bg-leaf flex items-center justify-center flex-shrink-0">
            <Search className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {destination ? (
              <>
                <p className="text-xs text-sub">Destination</p>
                <p className="text-base font-semibold text-text truncate">{destination}</p>
              </>
            ) : (
              <p className="text-base font-semibold text-sub">Where to?</p>
            )}
          </div>
          {destination ? (
            <ChevronRight className="w-4 h-4 text-sub flex-shrink-0" />
          ) : (
            origin && <span className="text-xs text-sub/70 font-mono-green flex-shrink-0">from {origin}</span>
          )}
        </button>
      </div>

      {/* ── Quick-pick grid ──────────────────────────────────── */}
      {popularRoutes.length > 0 && (
        <div className="px-4 mt-5">
          <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">
            Popular{origin ? ` from ${origin}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {popularRoutes.map((route) => {
              const active = destination === route.to_city;
              return (
                <button
                  key={route.to_city}
                  onClick={() => selectRoute(route)}
                  className={cn(
                    "flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all touch-target",
                    active ? "bg-forest border-leaf" : "bg-white border-border hover:border-leaf/40"
                  )}
                >
                  <MapPin className={cn("w-4 h-4 mb-2", active ? "text-lime" : "text-leaf")} />
                  <span className={cn("font-semibold text-sm leading-tight", active ? "text-white" : "text-text")}>
                    {route.to_city}
                  </span>
                  <span className={cn("text-xs mt-1 font-mono-green", active ? "text-lime/70" : "text-sub")}>
                    {route.distance_km} km · ₹{route.fare_rupees.toLocaleString("en-IN")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full-screen search overlay ───────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 bg-cream flex flex-col">
          {/* Header */}
          <div className="bg-forest px-4 pt-safe-top pb-3 flex-shrink-0">
            <div className="pt-3 flex items-center gap-3">
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-lime/70 hover:text-lime flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sub pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search destination…"
                  className="w-full pl-9 pr-8 py-2.5 bg-white rounded-xl text-sm text-text
                             placeholder:text-sub outline-none focus:ring-2 ring-leaf/30"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-sub" />
                  </button>
                )}
              </div>
            </div>
            {origin && (
              <p className="text-[11px] text-lime/40 mt-2 pl-9">from {origin}</p>
            )}
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto">
            {trimmed.length === 0 ? (
              <>
                {recentRoutes.length > 0 && (
                  <>
                    <SectionLabel>Recent</SectionLabel>
                    {recentRoutes.map((r) => (
                      <RouteRow key={`rec-${r.to_city}`} route={r} icon="clock" onSelect={() => selectRoute(r)} />
                    ))}
                    <div className="h-px bg-border mx-4 my-1" />
                  </>
                )}
                <SectionLabel>Popular{origin ? ` from ${origin}` : ""}</SectionLabel>
                {popularRoutes.map((r) => (
                  <RouteRow key={`pop-${r.to_city}`} route={r} onSelect={() => selectRoute(r)} />
                ))}
              </>
            ) : searchResults.length > 0 ? (
              <>
                <SectionLabel>{searchResults.length} route{searchResults.length !== 1 ? "s" : ""} found</SectionLabel>
                {searchResults.map((r) => (
                  <RouteRow
                    key={`${r.from_city}-${r.to_city}`}
                    route={r}
                    showOrigin={r.from_city !== origin}
                    onSelect={() => selectRoute(r)}
                  />
                ))}
              </>
            ) : (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-sub">No route found for &quot;{query.trim()}&quot;</p>
                <p className="text-xs text-sub/60 mt-1">Try the custom estimator on the home screen</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1.5 text-[11px] font-semibold text-sub uppercase tracking-wide">
      {children}
    </p>
  );
}

interface RouteRowProps {
  route: RouteInfo;
  icon?: "pin" | "clock";
  showOrigin?: boolean;
  onSelect: () => void;
}

function RouteRow({ route, icon = "pin", showOrigin, onSelect }: RouteRowProps) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left
                 hover:bg-warm active:bg-warm transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
        {icon === "clock"
          ? <Clock className="w-4 h-4 text-sub" />
          : <MapPin className="w-4 h-4 text-leaf" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-text leading-tight">{route.to_city}</p>
        <p className="text-xs text-sub font-mono-green mt-0.5">
          {route.distance_km} km · {formatDuration(route.duration_min)}
          {showOrigin && <span className="text-leaf"> · from {route.from_city}</span>}
        </p>
      </div>
      <div className="font-display text-base text-forest flex-shrink-0 ml-2">
        ₹{route.fare_rupees.toLocaleString("en-IN")}
      </div>
    </button>
  );
}
