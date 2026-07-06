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

interface FleetDriver {
  id: string;
  user: { name: string | null; phone: string };
  vehicle_number: string | null;
}

export default function VehiclesPage() {
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [drivers,   setDrivers]   = useState<FleetDriver[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [token,     setToken]     = useState<string | null>(null);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) { setLoading(false); return; }
        setToken(session.access_token);
        try {
          const headers = { Authorization: `Bearer ${session.access_token}` };
          const [vRes, dRes] = await Promise.all([
            fetch("/api/fleet/vehicles",      { headers }).then((r) => r.json()),
            fetch("/api/fleet/fleet-drivers", { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
          ]);
          setVehicles(vRes.data ?? []);
          setDrivers(dRes.data ?? []);
        } catch (err) {
          console.error("[fleet/vehicles]", err);
          setLoadError(true);
          toast.error("Failed to load vehicles");
        } finally { setLoading(false); }
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, current: boolean) {
    if (!token || toggling === id) return;
    setToggling(id);
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
    finally { setToggling(null); }
  }

  async function assignDriver(vehicleId: string, driverProfileId: string) {
    if (!token || assigning === vehicleId) return;
    setAssigning(vehicleId);
    try {
      const res = await fetch("/api/fleet/assign-driver", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ driver_profile_id: driverProfileId, vehicle_id: vehicleId }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to assign driver"); return; }
      toast.success("Driver assigned");
      setVehicles((prev) => prev.map((v) => v.id === vehicleId ? { ...v, driver_id: driverProfileId } : v));
    } catch { toast.error("Network error"); }
    finally { setAssigning(null); }
  }

  // Drivers already assigned to a vehicle (exclude from dropdown for other vehicles)
  const assignedDriverIds = new Set(vehicles.map((v) => v.driver_id).filter(Boolean));

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
      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-red-500 text-sm">Failed to load vehicles.</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-xs text-red-400 underline">Retry</button>
        </div>
      )}
      {!loading && !loadError && vehicles.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-4 grid grid-cols-3 gap-2 mb-4 text-center">
          <div>
            <p className="font-display text-2xl text-leaf">{vehicles.filter((v) => v.active).length}</p>
            <p className="text-[10px] text-sub uppercase tracking-wide">Active</p>
          </div>
          <div>
            <p className="font-display text-2xl text-sub">{vehicles.filter((v) => !v.active).length}</p>
            <p className="text-[10px] text-sub uppercase tracking-wide">Inactive</p>
          </div>
          <div>
            <p className="font-display text-2xl text-gold">{vehicles.filter((v) => !v.driver_id).length}</p>
            <p className="text-[10px] text-sub uppercase tracking-wide">No Driver</p>
          </div>
        </div>
      )}
      {!loading && !loadError && vehicles.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Truck className="w-8 h-8 text-sub" />
          <p className="text-center text-sub text-sm">No vehicles added yet.</p>
          <Link href="/fleet/vehicles/new"
            className="bg-leaf text-white text-sm font-semibold px-4 py-2 rounded-xl">
            Add First Vehicle
          </Link>
        </div>
      )}
      {vehicles.map((v) => {
        const freeDrivers = drivers.filter((d) => !assignedDriverIds.has(d.id) || v.driver_id === d.id);
        return (
          <div key={v.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-start gap-3">
              {v.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail_url} alt={v.number} loading="lazy" decoding="async"
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
                  <button onClick={() => toggleActive(v.id, v.active)} disabled={toggling === v.id} className="text-sub flex-shrink-0 p-2 disabled:opacity-50">
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
            {/* Inline assign driver — only show when no driver and free drivers exist */}
            {!v.driver_id && freeDrivers.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                {assigning === v.id ? (
                  <div className="flex items-center gap-1.5 text-xs text-sub">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…
                  </div>
                ) : (
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) assignDriver(v.id, e.target.value); }}
                    className="flex-1 text-xs border border-border rounded-xl px-3 py-2 bg-pale text-sub outline-none focus:border-leaf"
                  >
                    <option value="">Assign driver…</option>
                    {freeDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.user.name ?? d.user.phone}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
