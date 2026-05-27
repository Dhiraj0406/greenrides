"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Car } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface FleetDriver {
  id: string;
  license_number: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  is_online: boolean;
  user: { name: string | null; phone: string };
  vehicles: { id: string; make: string; model_name: string; number: string }[];
}
interface OwnerVehicle {
  id: string; make: string; model_name: string; number: string; driver_id: string | null;
}

export default function FleetDriversPage() {
  const [drivers, setDrivers]   = useState<FleetDriver[]>([]);
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [driversRes, vehiclesRes] = await Promise.all([
        fetch("/api/fleet/fleet-drivers", { headers }).then((r) => r.json()),
        fetch("/api/fleet/vehicles",      { headers }).then((r) => r.json()),
      ]);
      setDrivers(driversRes.data ?? []);
      setVehicles(vehiclesRes.data ?? []);
      setLoading(false);
    });
  }, []);

  async function assignVehicle(driverProfileId: string, vehicleId: string) {
    if (!token) return;
    const res = await fetch("/api/fleet/assign-driver", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ driver_profile_id: driverProfileId, vehicle_id: vehicleId }),
    });
    const j = await res.json();
    if (j.error) { toast.error(j.error); return; }
    toast.success("Driver assigned");
    setVehicles((prev) =>
      prev.map((v) => v.id === vehicleId ? { ...v, driver_id: driverProfileId } : v)
    );
  }

  const unassignedVehicles = vehicles.filter((v) => !v.driver_id);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Fleet Drivers</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && drivers.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Users className="w-8 h-8 text-sub" />
          <p className="text-center text-sub text-sm">No drivers in your fleet yet.</p>
        </div>
      )}
      {drivers.map((d) => {
        const assignedVehicle = vehicles.find((v) => v.driver_id === d.id);
        return (
          <div key={d.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-text text-sm">{d.user.name ?? "Driver"}</p>
                <p className="text-xs text-sub">+91 {d.user.phone}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                d.is_online ? "bg-leaf/10 text-leaf" : "bg-pale text-sub"
              }`}>
                {d.is_online ? "Online" : "Offline"}
              </span>
            </div>
            {assignedVehicle ? (
              <div className="flex items-center gap-2 text-xs text-sub">
                <Car className="w-3.5 h-3.5" />
                {assignedVehicle.make} {assignedVehicle.model_name} · {assignedVehicle.number}
              </div>
            ) : (
              <div>
                <p className="text-xs text-sub mb-1">Assign vehicle</p>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 ring-leaf/30"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) assignVehicle(d.id, e.target.value); }}
                >
                  <option value="" disabled>Select vehicle…</option>
                  {unassignedVehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.make} {v.model_name} · {v.number}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
