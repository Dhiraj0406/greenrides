"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Car, Calendar, User, Bell, LayoutDashboard, Truck, Users, TrendingUp, History, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "driver" | "owner";

const PUBLIC_PATHS = ["/fleet/login", "/fleet/register", "/fleet/pending"];

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  const pathname              = usePathname();
  const router                = useRouter();
  const [mode, setMode]       = useState<Mode>("driver");
  const [roles, setRoles]     = useState<string[]>([]);
  const [unread, setUnread]   = useState(0);
  const [token, setToken]     = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          setAuthChecked(true);
          if (!PUBLIC_PATHS.includes(pathname)) router.replace("/fleet/login");
          return;
        }
        setToken(session.access_token);
        const r: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
        setRoles(r);
        if (r.includes("owner") && !r.includes("driver")) setMode("owner");
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthChecked(true);
        if (!PUBLIC_PATHS.includes(pathname)) router.replace("/fleet/login");
      });
  }, [pathname, router]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/fleet/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data) setUnread(j.data.unread); })
      .catch(() => {});
  }, [token]);

  const isOwner   = roles.includes("owner");
  const isDriver  = roles.includes("driver");
  const canToggle = isOwner && isDriver;

  const driverNav = [
    { href: "/fleet/today",         label: "Today",    icon: Calendar },
    { href: "/fleet/history",       label: "History",  icon: History },
    { href: "/fleet/availability",  label: "Avail.",   icon: Car },
    { href: "/fleet/notifications", label: "Alerts",   icon: Bell, badge: unread },
    { href: "/fleet/profile",       label: "Profile",  icon: User },
  ];

  const ownerNav = [
    { href: "/fleet/dashboard",     label: "Dashboard", icon: LayoutDashboard },
    { href: "/fleet/vehicles",      label: "My Fleet",  icon: Truck },
    { href: "/fleet/fleet-drivers", label: "Drivers",   icon: Users },
    { href: "/fleet/earnings",      label: "Earnings",  icon: TrendingUp },
    { href: "/fleet/notifications", label: "Alerts",    icon: Bell, badge: unread },
  ];

  const nav = mode === "owner" ? ownerNav : driverNav;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!authChecked && !isPublicPath) {
    return (
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-leaf border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col">
      <header className="bg-forest px-4 pt-safe-top pb-4 flex items-center justify-between">
        <div className="pt-2">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest">Green Rides Fleet</p>
          <h1 className="font-display text-xl text-white capitalize">{mode} Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          {canToggle && (
            <button
              onClick={() => setMode(mode === "driver" ? "owner" : "driver")}
              className="bg-leaf/20 text-lime text-xs font-semibold px-3 py-1.5 rounded-full border border-lime/30"
            >
              Switch to {mode === "driver" ? "Owner" : "Driver"}
            </button>
          )}
          {mode === "owner" && (
            <button
              onClick={() => supabase.auth.signOut().then(() => router.replace("/fleet/login"))}
              className="flex items-center gap-1.5 text-lime/70 hover:text-lime text-xs font-medium"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </div>
      </header>

      <main className={isPublicPath ? "flex-1" : "flex-1 pb-20"}>{children}</main>

      {!isPublicPath && (
        <div className="text-center py-3 px-4">
          <a href="/fleet-agreement" className="text-[11px] text-sub underline mr-3">Fleet Agreement</a>
          <a href="/privacy" className="text-[11px] text-sub underline mr-3">Privacy</a>
          <a href="/terms" className="text-[11px] text-sub underline">Terms</a>
        </div>
      )}
      {!isPublicPath && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">
          <div className="green-container flex justify-around pt-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
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
      )}
    </div>
  );
}
