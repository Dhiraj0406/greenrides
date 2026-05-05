"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const CITIES = [
  "Koraput", "Jeypore", "Sunabeda", "Boipariguda", "Kundra",
  "Narayanpatna", "Malkangiri", "Rayagada", "Jagdalpur",
];

export function RideForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    from_city:       "",
    to_city:         "",
    departure_time:  "",
    total_seats:     "4",
    fare_paise:      "",
    pickup_points:   "",
    notes:           "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.from_city || !form.to_city || !form.departure_time || !form.fare_paise) {
      setError("Please fill all required fields.");
      return;
    }
    if (form.from_city === form.to_city) {
      setError("Origin and destination cannot be the same.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/rides", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_city:      form.from_city,
          to_city:        form.to_city,
          departure_time: new Date(form.departure_time).toISOString(),
          total_seats:    parseInt(form.total_seats),
          fare_paise:     parseInt(form.fare_paise) * 100,
          pickup_points:  form.pickup_points
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notes: form.notes || null,
          driver_id: "demo-driver-id", // Replace with auth user id
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      router.push("/driver/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post ride.");
    } finally {
      setLoading(false);
    }
  }

  const selectClass =
    "w-full bg-warm rounded-xl px-3 py-3 text-sm text-text outline-none " +
    "focus:ring-2 ring-leaf/30 appearance-none";
  const inputClass =
    "w-full bg-warm rounded-xl px-3 py-3 text-sm text-text placeholder:text-sub/60 " +
    "outline-none focus:ring-2 ring-leaf/30";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* From / To */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-sub font-semibold mb-1.5 block">From *</label>
          <select value={form.from_city} onChange={(e) => set("from_city", e.target.value)}
            className={selectClass}>
            <option value="">City</option>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-sub font-semibold mb-1.5 block">To *</label>
          <select value={form.to_city} onChange={(e) => set("to_city", e.target.value)}
            className={selectClass}>
            <option value="">City</option>
            {CITIES.filter((c) => c !== form.from_city).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Departure */}
      <div>
        <label className="text-xs text-sub font-semibold mb-1.5 block">Departure *</label>
        <input type="datetime-local" value={form.departure_time}
          onChange={(e) => set("departure_time", e.target.value)}
          className={inputClass} />
      </div>

      {/* Seats + Fare */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-sub font-semibold mb-1.5 block">Seats *</label>
          <select value={form.total_seats} onChange={(e) => set("total_seats", e.target.value)}
            className={selectClass}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-sub font-semibold mb-1.5 block">Fare (₹) *</label>
          <input type="number" min="0" value={form.fare_paise}
            onChange={(e) => set("fare_paise", e.target.value)}
            placeholder="120" className={inputClass} />
        </div>
      </div>

      {/* Pickup points */}
      <div>
        <label className="text-xs text-sub font-semibold mb-1.5 block">
          Pickup Points
          <span className="font-normal text-sub/70 ml-1">(comma-separated)</span>
        </label>
        <input type="text" value={form.pickup_points}
          onChange={(e) => set("pickup_points", e.target.value)}
          placeholder="Bus stand, Town hall" className={inputClass} />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-sub font-semibold mb-1.5 block">Notes</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
          rows={2} placeholder="AC car, ladies-preferred..."
          className={inputClass + " resize-none"} />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-leaf disabled:opacity-50 text-white font-semibold
                   py-4 rounded-xl touch-target flex items-center justify-center
                   gap-2 transition-colors hover:bg-leaf/90"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Ride →"}
      </button>
    </form>
  );
}
