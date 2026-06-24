"use client";

import { useState } from "react";
import { Loader2, Tag } from "lucide-react";

export function GlobalDiscount() {
  const [pct, setPct]         = useState("");
  const [label, setLabel]     = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  async function getAdminToken() {
    return sessionStorage.getItem("green_admin_token") ?? "";
  }

  async function fetchRouteIds(): Promise<string[]> {
    const adminToken = sessionStorage.getItem("green_admin_token") ?? "";
    const res = await fetch("/api/fares", { headers: { "x-admin-token": adminToken } });
    if (!res.ok) throw new Error("Failed to fetch routes");
    const json = await res.json();
    return (json.data ?? []).map((r: { id: string }) => r.id);
  }

  async function handleApply() {
    const discount = parseInt(pct);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setError("Enter a discount between 0–100");
      return;
    }
    setLoading(true);
    setSuccess(false);
    setError("");

    try {
      const [adminToken, routeIds] = await Promise.all([getAdminToken(), fetchRouteIds()]);
      const routes = routeIds.map((id) => ({
        id,
        fare_rule: {
          global_offer:   true,
          discount_on:    true,
          discount_pct:   discount,
          discount_label: label || null,
        },
      }));

      const res = await fetch("/api/fares", {
        method:  "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ routes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to apply discount");
      setSuccess(true);
      setPct("");
      setLabel("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply discount.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    setError("");
    try {
      const [adminToken, routeIds] = await Promise.all([getAdminToken(), fetchRouteIds()]);
      const routes = routeIds.map((id) => ({
        id,
        fare_rule: { global_offer: false, discount_on: false, discount_pct: 0 },
      }));

      const res = await fetch("/api/fares", {
        method:  "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ routes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove discount");
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-4 h-4 text-gold" />
        <span className="font-semibold text-sm text-text">Global Discount</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-sub mb-1.5 block">Discount %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => { setPct(e.target.value); setError(""); setSuccess(false); }}
            placeholder="e.g. 15"
            className="w-full bg-warm rounded-xl px-3 py-2.5 text-sm text-text
                       placeholder:text-sub/50 outline-none focus:ring-2 ring-leaf/30"
          />
        </div>
        <div>
          <label className="text-xs text-sub mb-1.5 block">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Summer sale"
            className="w-full bg-warm rounded-xl px-3 py-2.5 text-sm text-text
                       placeholder:text-sub/50 outline-none focus:ring-2 ring-leaf/30"
          />
        </div>
      </div>

      {error   && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {success && <p className="text-xs text-leaf mb-2">Discount applied successfully.</p>}

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={loading}
          className="flex-1 bg-gold/10 text-gold font-semibold text-sm py-2.5
                     rounded-xl disabled:opacity-50 hover:bg-gold/20 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Apply"}
        </button>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="flex-1 bg-warm text-sub font-semibold text-sm py-2.5
                     rounded-xl disabled:opacity-50 hover:bg-border transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
