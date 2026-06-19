"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck, Plus, ToggleLeft, ToggleRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
// thumbnail_url is now returned by the API (server-side signed URL via admin client)

interface Vehicle {
  id: string; make: string; model_name: string; number: string;
  seats: number; active: boolean; driver_id: string | null;
  photos: string[]; thumbnail_url: string | null;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [token,    setToken]    = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) { setLoading(false); return; }
        setToken(session.access_token);
        try {
          const j = await fetch("/api/fleet/vehicles", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then((r) => r.json());
          setVehicles(j.data ?? []);
        } catch (err) {
          console.error("[fleet/vehicles]", err);
          toast.error("Failed to load vehicles");
        } finally { setLoading(false); }
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, current: boolean) {
    if (!token) return;
    try {
      const res = await fetch(`/api/fleet/vehicles/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ active: !current }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to toggle vehicle"); return; }
      setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, active: !current } : v));
    } catch { toast.error("Network error"); }
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/fleet/dashboard" className="text-sub hover:text-text">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h2 className="font-display text-xl text-forest flex-1">My Fleet</h2>
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
          <div className="flex items-start gap-3">
            {v.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnail_url} alt={v.number}
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-pale border border-border flex-shrink-0 flex items-center justify-center">
                <Truck className="w-6 h-6 text-sub/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-text text-sm">{v.make} {v.model_name}</p>
                  <p className="text-xs text-sub">{v.number} · {v.seats} seats</p>
                  <p className={`text-xs font-semibold mt-1 ${v.driver_id ? "text-leaf" : "text-sub"}`}>
                    {v.driver_id ? "Driver assigned" : "No driver"}
                  </p>
                </div>
                <button onClick={() => toggleActive(v.id, v.active)} className="text-sub flex-shrink-0 p-2">
                  {v.active
                    ? <ToggleRight className="w-7 h-7 text-leaf" />
                    : <ToggleLeft  className="w-7 h-7" />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className={`text-[10px] font-semibold ${v.active ? "text-leaf" : "text-sub"}`}>
                  {v.active ? "Active" : "Inactive"}
                </p>
                {v.photos.length > 0 && (
                  <p className="text-[10px] text-sub">{v.photos.length} photo{v.photos.length > 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
