"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Calendar, Clock, User, Bell, LayoutDashboard, Truck, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "driver" | "owner";

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  const pathname              = usePathname();
  const [mode, setMode]       = useState<Mode>("driver");
  const [roles, setRoles]     = useState<string[]>([]);
  const [unread, setUnread]   = useState(0);
  const [token, setToken]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      const r: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
      setRoles(r);
      if (r.includes("owner") && !r.includes("driver")) setMode("owner");
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/fleet/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data) setUnread(j.data.unread); });
  }, [token]);

  const isOwner   = roles.includes("owner");
  const isDriver  = roles.includes("driver");
  const canToggle = isOwner && isDriver;

  const driverNav = [
    { href: "/fleet/today",         label: "Today",        icon: Calendar },
    { href: "/fleet/history",       label: "History",      icon: Clock },
    { href: "/fleet/availability",  label: "Availability", icon: Car },
    { href: "/fleet/notifications", label: "Alerts",       icon: Bell, badge: unread },
    { href: "/fleet/profile",       label: "Profile",      icon: User },
  ];

  const ownerNav = [
    { href: "/fleet/dashboard",     label: "Dashboard", icon: LayoutDashboard },
    { href: "/fleet/vehicles",      label: "My Fleet",  icon: Truck },
    { href: "/fleet/fleet-drivers", label: "Drivers",   icon: Users },
    { href: "/fleet/earnings",      label: "Earnings",  icon: TrendingUp },
    { href: "/fleet/notifications", label: "Alerts",    icon: Bell, badge: unread },
  ];

  const nav = mode === "owner" ? ownerNav : driverNav;

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col">
      <header className="bg-forest px-4 pt-safe-top pb-4 flex items-center justify-between">
        <div className="pt-2">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest">Green Rides Fleet</p>
          <h1 className="font-display text-xl text-white capitalize">{mode} Portal</h1>
        </div>
        {canToggle && (
          <button
            onClick={() => setMode(mode === "driver" ? "owner" : "driver")}
            className="bg-leaf/20 text-lime text-xs font-semibold px-3 py-1.5 rounded-full border border-lime/30"
          >
            Switch to {mode === "driver" ? "Owner" : "Driver"}
          </button>
        )}
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">
        <div className="green-container flex justify-around py-2">
          {nav.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 relative ${active ? "text-leaf" : "text-sub"}`}>
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
