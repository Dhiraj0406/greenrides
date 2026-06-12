"use client";

import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Clock, X, ArrowRight, Loader2 } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { formatDuration, cn } from "@/lib/utils";
import type { RouteInfo } from "@/types";

const FEATURED: Record<string, string[]> = {
  Koraput: ["Jeypore", "Rayagada", "Nabarangpur", "Damonjodi", "Semiliguda", "Visakhapatnam"],
  Jeypore: ["Koraput", "Rayagada", "Nabarangpur", "Visakhapatnam", "Vizianagaram", "Malkangiri"],
};

interface SuggestionRowProps {
  route: RouteInfo;
  highlighted: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  fromLabel?: string;
}

function SuggestionRow({ route, highlighted, onMouseDown, onMouseEnter, fromLabel }: SuggestionRowProps) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
      onMouseEnter={onMouseEnter}
      className={cn(
        "w-full flex items-center justify-between py-3 px-4 text-left transition-colors duration-100",
        highlighted ? "bg-pale" : "hover:bg-pale"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <MapPin className="w-4 h-4 text-leaf flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold text-sm text-text leading-tight truncate">{route.to_city}</div>
          <div className="text-xs text-sub font-mono-green mt-0.5">
            {route.distance_km} km · {formatDuration(route.duration_min)}
            {fromLabel && <span className="text-leaf ml-1">· {fromLabel}</span>}
          </div>
        </div>
      </div>
      <div className="font-display text-base text-forest flex-shrink-0 ml-4">
        ₹{route.fare_rupees.toLocaleString("en-IN")}
      </div>
    </button>
  );
}

interface Props {
  initialRoutes?: RouteInfo[];
}

export function DestinationGrid({ initialRoutes }: Props) {
  const { origin, destination, setOrigin, setDestination, setRouteData, setDiscount } = useBookingStore();

  // Ref-based cache to avoid stale closure issues in effects
  const routeCacheRef = useRef<Record<string, RouteInfo[]>>({
    Koraput: initialRoutes ?? [],
  });

  const [allRoutes, setAllRoutes]       = useState<RouteInfo[]>(initialRoutes ?? []);
  const [loading, setLoading]           = useState(false);
  const [query, setQuery]               = useState("");
  const [showAll, setShowAll]           = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-fetch Jeypore on mount so it's instant when user clicks it
  useEffect(() => {
    fetch("/api/routes?origin=Jeypore")
      .then((r) => r.json())
      .then((j) => { if (j.data) routeCacheRef.current.Jeypore = j.data; })
      .catch(() => {});
  }, []);

  // When origin changes: serve from cache immediately, or fetch on demand
  useEffect(() => {
    if (!origin) return;
    setQuery("");
    setShowAll(false);
    setShowDropdown(false);
    setHighlightedIndex(-1);

    const cached = routeCacheRef.current[origin];
    if (cached?.length) {
      setAllRoutes(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/routes?origin=${encodeURIComponent(origin)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.data) {
          routeCacheRef.current[origin] = j.data;
          setAllRoutes(j.data);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [origin]);

  // Click-outside: close dropdown when clicking outside the container
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  if (!origin) return null;

  const trimmed = query.trim().toLowerCase();

  // Primary: routes from current origin
  const suggestions: RouteInfo[] = trimmed.length >= 1
    ? allRoutes.filter((r) => r.to_city.toLowerCase().includes(trimmed)).slice(0, 6)
    : [];

  // Fallback: cross-origin results from cache when current origin has no match
  // eslint-disable-next-line react-hooks/refs -- routeCacheRef.current is a read-only cache, safe to read during render
  const crossSuggestions: RouteInfo[] = !loading && trimmed.length >= 1 && suggestions.length === 0
    ? Object.entries(routeCacheRef.current)
        .flatMap(([, routes]) => routes)
        .filter((r) => r.from_city !== origin && r.to_city.toLowerCase().includes(trimmed))
        .slice(0, 4)
    : [];

  // Grid display logic (unchanged from original, but only shown when dropdown is not active)
  let displayed: RouteInfo[];
  if (showAll) {
    displayed = allRoutes;
  } else {
    const featured = FEATURED[origin] ?? [];
    const featuredRoutes = featured
      .map((name) => allRoutes.find((r) => r.to_city === name))
      .filter(Boolean) as RouteInfo[];
    const rest = allRoutes.filter((r) => !featured.includes(r.to_city));
    displayed = [...featuredRoutes, ...rest].slice(0, 6);
  }

  function selectRoute(route: RouteInfo) {
    setDestination(route.to_city);
    setRouteData({
      km:   route.distance_km,
      min:  route.duration_min,
      text: route.duration_text,
      fare: route.fare_rupees,
    });
    // Pass discount display info — pct=0 so store doesn't re-calculate fare
    // (base_fare in DB is already the final price)
    setDiscount(0, route.discount_label ?? "");
    track.destinationSelected(origin!, route.to_city, route.fare_rupees);
    setTimeout(() => {
      document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleSelectSuggestion(route: RouteInfo) {
    selectRoute(route);
    setShowDropdown(false);
    setQuery("");
    setHighlightedIndex(-1);
  }

  function handleSelectCrossOrigin(route: RouteInfo) {
    // Switch origin, then set destination + fare atomically
    setOrigin(route.from_city);
    setDestination(route.to_city);
    setRouteData({ km: route.distance_km, min: route.duration_min, text: route.duration_text, fare: route.fare_rupees });
    setDiscount(0, route.discount_label ?? "");
    track.destinationSelected(route.from_city, route.to_city, route.fare_rupees);
    setShowDropdown(false);
    setQuery("");
    setHighlightedIndex(-1);
    setTimeout(() => {
      document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        suggestions.length === 0 ? -1 : (prev + 1) % suggestions.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        suggestions.length === 0
          ? -1
          : prev <= 0
          ? suggestions.length - 1
          : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else if (suggestions.length === 1) {
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowDropdown(false);
      setQuery("");
      setHighlightedIndex(-1);
    }
  }

  const dropdownVisible = showDropdown && trimmed.length >= 1;

  return (
    <section className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-text">
          Where to from <span className="text-leaf">{origin}</span>?
        </h2>
        {!showAll && !trimmed && allRoutes.length > 6 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-leaf font-semibold"
          >
            All routes →
          </button>
        )}
      </div>

      {/* Search box + dropdown container */}
      <div ref={containerRef} className="relative mb-4">
        {/* Search input */}
        <div className="relative">
          {loading
            ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-leaf animate-spin pointer-events-none" />
            : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sub pointer-events-none" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            disabled={loading}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(-1);
              if (e.target.value.trim().length >= 1) {
                setShowDropdown(true);
              } else {
                setShowDropdown(false);
              }
            }}
            onFocus={() => {
              if (trimmed.length >= 1) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Loading routes…" : "Search any destination…"}
            className="w-full pl-9 pr-9 py-3 bg-white border border-border rounded-xl
                       text-sm text-text placeholder:text-sub focus:outline-none
                       focus:border-leaf focus:ring-1 focus:ring-leaf/30 touch-target
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {query && !loading && (
            <button
              onClick={() => {
                setQuery("");
                setShowDropdown(false);
                setHighlightedIndex(-1);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
            >
              <X className="w-4 h-4 text-sub" />
            </button>
          )}
        </div>

        {/* Floating dropdown panel */}
        {dropdownVisible && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-white
                       rounded-xl shadow-lg border border-border
                       max-h-[280px] overflow-y-auto"
          >
            {loading ? (
              <div className="py-3 px-4 text-sm text-sub flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-leaf flex-shrink-0" />
                Loading routes…
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((route, idx) => (
                <SuggestionRow
                  key={route.to_city}
                  route={route}
                  highlighted={idx === highlightedIndex}
                  onMouseDown={() => handleSelectSuggestion(route)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                />
              ))
            ) : crossSuggestions.length > 0 ? (
              <>
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-sub uppercase tracking-wide">
                  Switch origin
                </div>
                {crossSuggestions.map((route) => (
                  <SuggestionRow
                    key={`${route.from_city}-${route.to_city}`}
                    route={route}
                    highlighted={false}
                    onMouseDown={() => handleSelectCrossOrigin(route)}
                    onMouseEnter={() => {}}
                    fromLabel={`from ${route.from_city}`}
                  />
                ))}
              </>
            ) : (
              <div className="py-3 px-4 text-sm text-sub">
                No route found. Try the custom estimator below.
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-warm rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Grid of route cards — hidden when dropdown is active with a query */}
      {!loading && !dropdownVisible && displayed.length > 0 && (
        <div className="space-y-3">
          {displayed.map((route) => {
            const active     = destination === route.to_city;
            const discounted = (route.discount_pct ?? 0) > 0;
            // "Was ₹XXX" in discount_label means show strikethrough original price
            const originalPrice = route.discount_label?.startsWith("Was ₹")
              ? route.discount_label.replace("Was ", "")
              : null;

            return (
              <button
                key={route.to_city}
                onClick={() => selectRoute(route)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border touch-target",
                  "transition-all duration-200 text-left",
                  active
                    ? "bg-forest border-leaf shadow-lg"
                    : "bg-white border-border hover:border-leaf/50 hover:shadow-sm"
                )}
              >
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                  active ? "bg-leaf/20" : "bg-pale"
                )}>
                  <MapPin className={cn("w-5 h-5", active ? "text-lime" : "text-leaf")} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold text-base leading-tight",
                      active ? "text-white" : "text-text"
                    )}>
                      {route.to_city}
                    </span>
                    {discounted && (
                      <span className="text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">
                        {route.discount_pct}% OFF
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 mt-0.5 text-xs font-mono-green",
                    active ? "text-lime/70" : "text-sub"
                  )}>
                    <span>{route.distance_km} km</span>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(route.duration_min)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className={cn(
                      "font-display text-2xl font-bold leading-none",
                      active ? "text-lime" : "text-forest"
                    )}>
                      ₹{route.fare_rupees.toLocaleString("en-IN")}
                    </div>
                    {originalPrice ? (
                      <div className={cn(
                        "text-xs line-through mt-0.5",
                        active ? "text-lime/50" : "text-sub"
                      )}>
                        {originalPrice}
                      </div>
                    ) : (
                      <div className={cn(
                        "text-[10px] font-semibold mt-0.5",
                        active ? "text-lime/60" : "text-sub"
                      )}>
                        Entire cab
                      </div>
                    )}
                  </div>
                  <ArrowRight className={cn(
                    "w-4 h-4 flex-shrink-0",
                    active ? "text-lime" : "text-sub"
                  )} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !dropdownVisible && allRoutes.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full mt-4 py-3 text-sm font-semibold text-leaf
                     bg-pale rounded-xl hover:bg-leaf/10 transition-colors"
        >
          {showAll
            ? "Show fewer routes ↑"
            : `Show all ${allRoutes.length} routes from ${origin} ↓`}
        </button>
      )}
    </section>
  );
}
