"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import type { FareEstimateResult } from "@/types";

export function CustomRouteBox() {
  const { origin, setDestination, setRouteData, setDiscount } = useBookingStore();
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FareEstimateResult | null>(null);
  const [error, setError] = useState("");

  if (!origin) return null;

  async function handleEstimate() {
    if (!to.trim()) return;
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
      setDiscount(0, ""); // clear any stale discount from a previous selection
    } catch (err) {
      setError("Could not estimate fare. Please try a different route.");
    } finally {
      setLoading(false);
    }
  }

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
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEstimate()}
            placeholder="Any city in Odisha"
            className="flex-1 bg-warm rounded-xl px-3 py-2.5 text-sm text-text
                       placeholder:text-sub/60 outline-none focus:ring-2 ring-leaf/30"
          />
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
                  ₹{result.fare}
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
                {result.confidence === "high" ? "High confidence" : "Estimated"}
              </span>
            </div>
            <p className="text-xs text-sub mt-1">{result.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}
