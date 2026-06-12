"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Navigation, Ticket, User, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
}

export function BottomNav() {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const items: NavItem[] = [
    { href: "/",         label: "Home",    icon: Home       },
    { href: "/tracker",  label: "Tracker", icon: Navigation },
    { href: "/bookings", label: "Trips",   icon: Ticket     },
    ...(isAuthed
      ? [{ href: "/profile", label: "Account", icon: User  } as NavItem]
      : [{ href: "/login",   label: "Sign In", icon: LogIn } as NavItem]
    ),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div
        className="green-container mx-auto flex items-stretch"
        style={{
          background: "var(--paper)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 relative touch-target"
              style={{ color: isActive ? "var(--green)" : "var(--ink-4)" }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                {item.label}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "var(--green)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
