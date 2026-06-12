"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { ALL_PLACES, STATIC_ROUTES } from "@/data/static-routes";
import type { FareEstimateResult } from "@/types";

export function CustomRouteBox() {
  const { origin, setDestination, setRouteData, setDiscount } = useBookingStore();
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FareEstimateResult | null>(null);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(value: string) {
    setTo(value);
    setResult(null);
    setError("");
    if (value.length >= 1) {
      const q = value.toLowerCase();
      const filtered = ALL_PLACES.filter(
        (p) => p.toLowerCase().includes(q) && p !== origin
      );
      setSuggestions(filtered.slice(0, 8));
      setShowDropdown(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }

  function selectSuggestion(place: string) {
    setTo(place);
    setSuggestions([]);
    setShowDropdown(false);

    // If there's a static route for origin → place, use it directly without API call
    if (origin) {
      const staticRoute = STATIC_ROUTES.find(
        (r) => r.from_city === origin && r.to_city === place
      );
      if (staticRoute) {
        const r = staticRoute;
        const fareEstimate: FareEstimateResult = {
          from: origin,
          to: place,
          distance_km: r.distance_km,
          duration_min: r.duration_min,
          duration_text: r.duration_text,
          fare: r.fare_rupees,
          confidence: "high",
          notes: `${r.distance_km} km · ${r.duration_text} by road`,
        };
        setResult(fareEstimate);
        setDestination(place);
        setRouteData({
          km:   r.distance_km,
          min:  r.duration_min,
          text: r.duration_text,
          fare: r.fare_rupees,
        });
        setDiscount(0, "");
        setTimeout(() => {
          document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
        return;
      }
    }

    // Unknown route — will need AI estimate when user clicks Calculate
  }

  async function handleEstimate() {
    if (!to.trim()) return;

    // Try static match first
    if (origin) {
      const staticRoute = STATIC_ROUTES.find(
        (r) => r.from_city === origin && r.to_city === to.trim()
      );
      if (staticRoute) {
        selectSuggestion(to.trim());
        return;
      }
    }

    setLoading(true);
    setError("");
    setResult(null);
    track.customRouteStarted();

    try {
      const res = await fetch("/api/ai/estimate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: origin, to: to.trim() }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const data = json.data as FareEstimateResult;
      setResult(data);
      setDestination(data.to);
      setRouteData({
        km:   data.distance_km,
        min:  data.duration_min,
        text: data.duration_text,
        fare: data.fare,
      });
      setDiscount(0, "");
    } catch {
      setError("Could not estimate fare. Please try a different route.");
    } finally {
      setLoading(false);
    }
  }

  if (!origin) return null;

  return (
    <section className="px-4 mt-6">
      <div className="bg-white border border-border rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-text">Custom route</span>
          <span className="text-xs text-sub ml-1">AI fare estimate</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-warm rounded-xl px-3 py-2.5 text-sm text-sub font-medium">
            {origin}
          </div>
          <ArrowRight className="w-4 h-4 text-sub flex-shrink-0" />
          <div className="flex-1 relative" ref={dropdownRef}>
            <input
              ref={inputRef}
              type="text"
              value={to}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => to.length >= 1 && suggestions.length > 0 && setShowDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setShowDropdown(false); handleEstimate(); }
                if (e.key === "Escape") setShowDropdown(false);
              }}
              placeholder="Any city in Odisha"
              autoComplete="off"
              className="w-full bg-warm rounded-xl px-3 py-2.5 text-sm text-text
                         placeholder:text-sub/60 outline-none focus:ring-2 ring-leaf/30"
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50
                              bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((place) => {
                  const isKnown = origin
                    ? STATIC_ROUTES.some((r) => r.from_city === origin && r.to_city === place)
                    : false;
                  return (
                    <button
                      key={place}
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(place); }}
                      className="w-full flex items-center justify-between px-3 py-2.5
                                 text-sm text-left hover:bg-pale transition-colors"
                    >
                      <span className="text-text font-medium">{place}</span>
                      {isKnown && (
                        <span className="text-[10px] text-leaf font-semibold ml-2 flex-shrink-0">
                          fixed fare
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleEstimate}
          disabled={loading || !to.trim()}
          className="mt-3 w-full flex items-center justify-center gap-2
                     bg-forest-b hover:bg-forest-b/90 disabled:opacity-50
                     text-white text-sm font-semibold py-3 rounded-xl
                     touch-target transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Calculate Fare →"
          )}
        </button>

        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}

        {result && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-sub">{result.from} → {result.to}</p>
                <p className="font-display text-2xl text-forest mt-0.5">
                  ₹{result.fare.toLocaleString("en-IN")}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  result.confidence === "high"
                    ? "bg-leaf/10 text-leaf"
                    : result.confidence === "medium"
                    ? "bg-gold/10 text-gold"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {result.confidence === "high" ? "Fixed fare" : "Estimated"}
              </span>
            </div>
            <p className="text-xs text-sub mt-1">{result.notes}</p>
            <p className="text-[10px] text-center mt-2" style={{ color: "var(--ink-4)" }}>
              Powered by Claude AI
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
