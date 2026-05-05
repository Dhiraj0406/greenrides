"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ComponentType<{ className?: string }>;
  driverOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",          label: "Home",     icon: Home   },
  { href: "/bookings",  label: "Trips",    icon: Ticket },
  { href: "/driver/post-ride", label: "Post", icon: Plus, driverOnly: true },
  { href: "/profile",   label: "Profile",  icon: User   },
];

export function BottomNav({ isDriver = false }: { isDriver?: boolean }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter(
    (item) => !item.driverOnly || isDriver
  );

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
