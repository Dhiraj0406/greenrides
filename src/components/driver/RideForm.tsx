"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CITIES = [
  "Koraput", "Jeypore", "Sunabeda", "Boipariguda", "Kundra",
  "Narayanpatna", "Malkangiri", "Rayagada", "Jagdalpur",
];

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function buildDepartureISO(date: string, hour: string, minute: string, ampm: string): string {
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return new Date(`${date}T${String(h).padStart(2, "0")}:${minute}:00+05:30`).toISOString();
}

export function RideForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    from_city:     "",
    to_city:       "",
    date:          "",
    hour:          "8",
    minute:        "00",
    ampm:          "AM",
    total_seats:   "4",
    fare_paise:    "",
    pickup_points: "",
    notes:         "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.from_city || !form.to_city || !form.date || !form.fare_paise) {
      setError("Please fill all required fields.");
      return;
    }
    if (form.from_city === form.to_city) {
      setError("Origin and destination cannot be the same.");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please log in to post a ride."); return; }

      const res = await fetch("/api/rides", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          from_city:      form.from_city,
          to_city:        form.to_city,
          departure_time: buildDepartureISO(form.date, form.hour, form.minute, form.ampm),
          total_seats:    parseInt(form.total_seats),
          fare_paise:     parseInt(form.fare_paise) * 100,
          pickup_points:  form.pickup_points
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Failed to post ride");
      router.push("/drivers/dashboard");
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

      {/* Departure Date */}
      <div>
        <label className="text-xs text-sub font-semibold mb-1.5 block">Departure Date *</label>
        <input type="date" value={form.date}
          min={todayIST()}
          onChange={(e) => set("date", e.target.value)}
          className={inputClass} />
      </div>

      {/* Departure Time */}
      <div>
        <label className="text-xs text-sub font-semibold mb-1.5 block">Departure Time *</label>
        <div className="grid grid-cols-3 gap-2">
          <select value={form.hour} onChange={(e) => set("hour", e.target.value)} className={selectClass}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map((h) => (
              <option key={h} value={String(h)}>{h}</option>
            ))}
          </select>
          <select value={form.minute} onChange={(e) => set("minute", e.target.value)} className={selectClass}>
            {["00","15","30","45"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={form.ampm} onChange={(e) => set("ampm", e.target.value)} className={selectClass}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      {/* Fare */}
      <div>
        <label className="text-xs text-sub font-semibold mb-1.5 block">Full Cab Fare (₹) *</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.fare_paise}
          onChange={(e) => set("fare_paise", e.target.value.replace(/\D/g, ""))}
          placeholder="120"
          className={inputClass}
        />
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
        disabled={loading || !form.from_city || !form.to_city || !form.date || !form.fare_paise}
        className="w-full bg-leaf disabled:opacity-50 text-white font-semibold
                   py-4 rounded-xl touch-target flex items-center justify-center
                   gap-2 transition-colors hover:bg-leaf/90"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Ride →"}
      </button>
    </form>
  );
}
