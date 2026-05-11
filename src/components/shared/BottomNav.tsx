"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, Plus, User, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface NavItem {
  href:        string;
  label:       string;
  icon:        React.ComponentType<{ className?: string }>;
  driverOnly?: boolean;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/",                 label: "Home",  icon: Home   },
  { href: "/bookings",         label: "Trips", icon: Ticket },
  { href: "/driver/post-ride", label: "Post",  icon: Plus,  driverOnly: true },
];

export function BottomNav({ isDriver = false }: { isDriver?: boolean }) {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const authItem: NavItem = isAuthed
    ? { href: "/profile", label: "Profile", icon: User  }
    : { href: "/login",   label: "Login",   icon: LogIn };

  const items = [
    ...BASE_NAV_ITEMS.filter((item) => !item.driverOnly || isDriver),
    authItem,
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 green-container mx-auto">
      <div
        className="bg-forest border-t border-forest-mid flex items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 gap-1 touch-target",
                "transition-colors",
                isActive ? "text-lime" : "text-lime/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
