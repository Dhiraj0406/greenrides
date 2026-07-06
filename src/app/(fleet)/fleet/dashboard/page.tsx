"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck, Users, DollarSign, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface DashboardData {
  vehicles: { total: number; active: number };
  drivers: number;
  earnings: { totalEarned: number };
  unassignedDrivers: number;
}

function StatCard({ icon: Icon, label, value, href }: {
  icon: React.ElementType; label: string; value: string | number; href: string;
}) {
  return (
    <Link href={href}
      className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-leaf/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-leaf" />
      </div>
      <div>
        <p className="text-xs text-sub">{label}</p>
        <p className="text-lg font-bold text-text">{value}</p>
      </div>
    </Link>
  );
}

export default function OwnerDashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [vehiclesRes, earningsRes, driversRes] = await Promise.all([
          fetch("/api/fleet/vehicles",      { headers }).then((r) => r.json()),
          fetch("/api/fleet/earnings",      { headers }).then((r) => r.json()),
          fetch("/api/fleet/fleet-drivers", { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        ]);
        const vehicles      = vehiclesRes.data ?? [];
        const fleetDrivers  = driversRes.data ?? [];
        if (!earningsRes.data && earningsRes.error) {
          toast.error("Could not load earnings data");
        }
        const assignedDriverIds = new Set(
          vehicles.map((v: { driver_id: string | null }) => v.driver_id).filter(Boolean)
        );
        setData({
          vehicles: { total: vehicles.length, active: vehicles.filter((v: { active: boolean }) => v.active).length },
          drivers:  vehicles.filter((v: { driver_id: string | null }) => v.driver_id).length,
          earnings: earningsRes.data ?? { totalEarned: 0 },
          unassignedDrivers: fleetDrivers.filter((d: { id: string }) => !assignedDriverIds.has(d.id)).length,
        });
      } catch { setLoadError(true); }
      finally { setLoading(false); }
    }).catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Owner Dashboard</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-red-500 text-sm">Failed to load dashboard data.</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-xs text-red-400 underline">Retry</button>
        </div>
      )}
      {!loading && !loadError && data && (
        <>
          {data.unassignedDrivers > 0 && (
            <div className="bg-gold/10 border border-gold/30 rounded-2xl p-4 flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-gold flex-shrink-0" />
              <p className="text-sm text-text flex-1">
                {data.unassignedDrivers} driver{data.unassignedDrivers > 1 ? "s have" : " has"} no assigned vehicle.
              </p>
              <Link href="/fleet/fleet-drivers" className="text-leaf text-sm font-semibold flex-shrink-0">
                Assign →
              </Link>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard icon={Truck}      label="Total Vehicles"   value={data.vehicles.total}  href="/fleet/vehicles" />
            <StatCard icon={Truck}      label="Active Vehicles"  value={data.vehicles.active} href="/fleet/vehicles" />
            <StatCard icon={Users}      label="Assigned Drivers" value={data.drivers}          href="/fleet/fleet-drivers" />
            <StatCard
              icon={DollarSign}
              label="Total Earned"
              value={`₹${Math.round(data.earnings.totalEarned / 100)}`}
              href="/fleet/earnings"
            />
          </div>
          {data.vehicles.total > 0 && (
            <div className="bg-white border border-border rounded-2xl p-5 mb-3">
              <p className="text-xs font-bold text-sub uppercase tracking-wide mb-2">Fleet Utilization</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="font-display text-3xl text-forest">{data.vehicles.active}/{data.vehicles.total}</p>
                <p className="text-sm text-sub mb-1">
                  {Math.round((data.vehicles.active / data.vehicles.total) * 100)}% active
                </p>
              </div>
              <div className="bg-pale h-2 rounded-full w-full">
                <div
                  className="bg-leaf h-2 rounded-full transition-all"
                  style={{ width: `${(data.vehicles.active / data.vehicles.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
      <Link href="/fleet/vehicles/new"
        className="mt-6 block w-full bg-leaf text-white text-sm font-semibold py-3 rounded-xl text-center">
        + Add Vehicle
      </Link>
    </div>
  );
}
