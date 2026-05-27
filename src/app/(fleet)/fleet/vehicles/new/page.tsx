"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function NewVehiclePage() {
  const router  = useRouter();
  const [form, setForm]       = useState({ make: "", model_name: "", number: "", seats: "4" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); setLoading(false); return; }

    const res = await fetch("/api/fleet/vehicles", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ ...form, seats: parseInt(form.seats, 10) }),
    });
    const j = await res.json();
    setLoading(false);
    if (j.error) { toast.error(j.error); return; }
    toast.success("Vehicle added");
    router.replace("/fleet/vehicles");
  }

  const inputClass = "w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30";

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-6">Add Vehicle</h2>
      <div className="space-y-3">
        <input type="text" placeholder="Make (e.g. Toyota)"
          value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })}
          className={inputClass} />
        <input type="text" placeholder="Model (e.g. Innova Crysta)"
          value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })}
          className={inputClass} />
        <input type="text" placeholder="Number plate (e.g. KA01AB1234)"
          value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.toUpperCase() })}
          className={inputClass} />
        <div>
          <label className="block text-xs text-sub mb-1">Seats</label>
          <select value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })}
            className={inputClass}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button onClick={handleSubmit}
          disabled={loading || !form.make || !form.model_name || !form.number}
          className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Vehicle"}
        </button>
      </div>
    </div>
  );
}
