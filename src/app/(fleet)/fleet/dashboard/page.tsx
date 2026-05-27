"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck, Users, DollarSign } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface DashboardData {
  vehicles: { total: number; active: number };
  drivers: number;
  earnings: { totalEarned: number };
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [vehiclesRes, earningsRes] = await Promise.all([
        fetch("/api/fleet/vehicles", { headers }).then((r) => r.json()),
        fetch("/api/fleet/earnings",  { headers }).then((r) => r.json()),
      ]);
      const vehicles = vehiclesRes.data ?? [];
      setData({
        vehicles: { total: vehicles.length, active: vehicles.filter((v: { active: boolean }) => v.active).length },
        drivers:  vehicles.filter((v: { driver_id: string | null }) => v.driver_id).length,
        earnings: earningsRes.data ?? { totalEarned: 0 },
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Owner Dashboard</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && data && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Truck}      label="Total Vehicles"  value={data.vehicles.total}  href="/fleet/vehicles" />
          <StatCard icon={Truck}      label="Active Vehicles" value={data.vehicles.active} href="/fleet/vehicles" />
          <StatCard icon={Users}      label="Assigned Drivers" value={data.drivers}         href="/fleet/fleet-drivers" />
          <StatCard
            icon={DollarSign}
            label="Total Earned"
            value={`₹${Math.round(data.earnings.totalEarned / 100)}`}
            href="/fleet/earnings"
          />
        </div>
      )}
      <Link href="/fleet/vehicles/new"
        className="mt-6 block w-full bg-leaf text-white text-sm font-semibold py-3 rounded-xl text-center">
        + Add Vehicle
      </Link>
    </div>
  );
}
