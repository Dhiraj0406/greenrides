"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ClipboardList, Users, IndianRupee, TrendingUp, Tag, CheckSquare, Truck, Wallet, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";

interface Stats {
  pending:   number;
  confirmed: number;
  completed: number;
  cancelled: number;
  total:     number;
  revenue:   number;
}

function Dashboard({ token }: { token: string }) {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/requests", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reqs: any[] = j.data;
        setStats({
          pending:   reqs.filter((r) => r.status === "PENDING").length,
          confirmed: reqs.filter((r) => r.status === "CONFIRMED").length,
          completed: reqs.filter((r) => r.status === "COMPLETED").length,
          cancelled: reqs.filter((r) => r.status === "CANCELLED").length,
          total:     reqs.length,
          revenue:   reqs
            .filter((r) => r.status === "COMPLETED")
            .reduce((sum: number, r) => sum + r.fare_paise, 0),
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  const cards = [
    { label: "Pending",   value: stats?.pending   ?? "—", icon: ClipboardList, color: "text-gold bg-gold/10",       href: "/admin/bookings?status=PENDING"   },
    { label: "Confirmed", value: stats?.confirmed ?? "—", icon: TrendingUp,    color: "text-leaf bg-leaf/10",       href: "/admin/bookings?status=CONFIRMED" },
    { label: "Completed", value: stats?.completed ?? "—", icon: IndianRupee,   color: "text-forest bg-forest/10",  href: "/admin/bookings?status=COMPLETED" },
    { label: "Drivers",   value: "→",                     icon: Users,         color: "text-sub bg-warm",           href: "/admin/drivers"                   },
  ];

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
          <h1 className="font-display text-2xl text-white">Dashboard</h1>
        </div>
      </header>

      <div className="px-4 mt-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        ) : (
          <>
            {stats && stats.revenue > 0 && (
              <div className="bg-forest rounded-2xl p-5 text-white mb-5">
                <p className="text-lime/60 text-xs uppercase tracking-wide mb-1">Total Revenue</p>
                <p className="font-display text-4xl text-white">₹{(stats.revenue / 100).toLocaleString("en-IN")}</p>
                <p className="text-lime/50 text-xs mt-1">{stats.completed} trips completed</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {cards.map(({ label, value, icon: Icon, color, href }) => (
                <Link key={label} href={href}
                  className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-leaf/50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-display text-2xl text-forest">{value}</p>
                    <p className="text-xs text-sub">{label}</p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="space-y-2">
              <Link href="/admin/bookings"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Manage Bookings</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/drivers"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Manage Drivers</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/fares"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Manage Fares</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/approvals"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-5 h-5 text-gold" />
                  <span className="text-sm font-semibold text-text">Fleet Approvals</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/owners"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Fleet Owners</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/payouts"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Payouts</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/documents"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">KYC Documents</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/config"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Remote Config</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <span className="text-sm font-semibold text-text">← Back to App</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return <AdminGate>{(token) => <Dashboard token={token} />}</AdminGate>;
}
