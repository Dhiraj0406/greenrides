"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Vehicle {
  id: string; make: string; model_name: string; number: string;
  seats: number; active: boolean; driver_id: string | null;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      fetch("/api/fleet/vehicles", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setVehicles(j.data ?? []); setLoading(false); });
    });
  }, []);

  async function toggleActive(id: string, current: boolean) {
    if (!token) return;
    const res = await fetch(`/api/fleet/vehicles/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ active: !current }),
    });
    const j = await res.json();
    if (j.error) { toast.error(j.error); return; }
    setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, active: !current } : v));
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-forest">My Fleet</h2>
        <Link href="/fleet/vehicles/new"
          className="flex items-center gap-1 text-xs font-semibold text-leaf">
          <Plus className="w-4 h-4" /> Add
        </Link>
      </div>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && vehicles.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Truck className="w-8 h-8 text-sub" />
          <p className="text-center text-sub text-sm">No vehicles added yet.</p>
          <Link href="/fleet/vehicles/new"
            className="bg-leaf text-white text-sm font-semibold px-4 py-2 rounded-xl">
            Add First Vehicle
          </Link>
        </div>
      )}
      {vehicles.map((v) => (
        <div key={v.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-text text-sm">{v.make} {v.model_name}</p>
              <p className="text-xs text-sub">{v.number} · {v.seats} seats</p>
              <p className={`text-xs font-semibold mt-1 ${v.driver_id ? "text-leaf" : "text-sub"}`}>
                {v.driver_id ? "Driver assigned" : "No driver"}
              </p>
            </div>
            <button onClick={() => toggleActive(v.id, v.active)} className="text-sub">
              {v.active
                ? <ToggleRight className="w-7 h-7 text-leaf" />
                : <ToggleLeft  className="w-7 h-7" />}
            </button>
          </div>
          <p className={`text-[10px] font-semibold mt-2 ${v.active ? "text-leaf" : "text-sub"}`}>
            {v.active ? "Active" : "Inactive"}
          </p>
        </div>
      ))}
    </div>
  );
}
