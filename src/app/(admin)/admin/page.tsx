"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ClipboardList, Users, IndianRupee, TrendingUp, Tag, CheckSquare, Truck, Wallet, ShieldCheck, SlidersHorizontal, Car, Percent, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface Stats {
  pending:   number;
  confirmed: number;
  completed: number;
  cancelled: number;
  total:     number;
  revenue:   number;
}
interface QuickStats {
  today_revenue:    number;
  week_revenue:     number;
  active_trips:     number;
  pending_requests: number;
}

function Dashboard({ token }: { token: string }) {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
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
        }),
      fetch("/api/admin/stats", { headers: { "x-admin-token": token } })
        .then((r) => r.json())
        .then((j) => { if (j.data) setQuickStats(j.data); }),
    ])
      .catch(() => toast.error("Failed to load dashboard stats"))
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
            {/* Revenue hero */}
            <div className="bg-forest rounded-2xl p-5 text-white mb-5">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-lime/60 text-xs uppercase tracking-wide mb-1">Today&apos;s Revenue</p>
                  <p className="font-display text-4xl text-white">
                    ₹{((quickStats?.today_revenue ?? 0) / 100).toLocaleString("en-IN")}
                  </p>
                </div>
                {quickStats && quickStats.active_trips > 0 && (
                  <div className="text-right">
                    <p className="text-lime/60 text-xs uppercase tracking-wide mb-1">Active Now</p>
                    <p className="font-display text-2xl text-lime">{quickStats.active_trips}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                <div>
                  <p className="text-lime/50 text-[10px] uppercase tracking-wide">This Week</p>
                  <p className="text-white font-semibold text-sm">₹{((quickStats?.week_revenue ?? 0) / 100).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-lime/50 text-[10px] uppercase tracking-wide">All Time</p>
                  <p className="text-white font-semibold text-sm">₹{((stats?.revenue ?? 0) / 100).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-lime/50 text-[10px] uppercase tracking-wide">Total Trips</p>
                  <p className="text-white font-semibold text-sm">{stats?.completed ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Live metrics strip */}
            {quickStats && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white border border-border rounded-xl p-3 text-center">
                  <p className="font-display text-2xl text-leaf">{quickStats.active_trips}</p>
                  <p className="text-[10px] text-sub uppercase tracking-wide mt-0.5">Active</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-3 text-center">
                  <p className="font-display text-2xl text-gold">{quickStats.pending_requests}</p>
                  <p className="text-[10px] text-sub uppercase tracking-wide mt-0.5">Pending</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-3 text-center">
                  <p className="font-display text-2xl text-text">{stats?.completed ?? 0}</p>
                  <p className="text-[10px] text-sub uppercase tracking-wide mt-0.5">Done</p>
                </div>
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
              <Link href="/admin/vehicles"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Vehicles & Photos</span>
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
              <Link href="/admin/used-cars"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Used Cars</span>
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
              <Link href="/admin/commission"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Percent className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Commission Rates</span>
                </div>
                <span className="text-sub text-sm">→</span>
              </Link>
              <Link href="/admin/logs"
                className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
                <div className="flex items-center gap-3">
                  <ScrollText className="w-5 h-5 text-leaf" />
                  <span className="text-sm font-semibold text-text">Activity Log</span>
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
