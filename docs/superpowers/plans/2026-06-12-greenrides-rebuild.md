# GreenRides Full Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the GreenRides spec's UI/UX, design system, and missing features to the existing Next.js 16 + Supabase codebase — without migrating tech stacks.

**Architecture:** This is a Next.js 16 monorepo with Supabase for auth/DB, Tailwind CSS v4 for styling, deployed on Vercel. The spec prescribes React+Vite+Firebase but the existing codebase is superior and production-deployed — adapt spec requirements to it instead. Route groups (`(booking)`, `(driver)`, `(fleet)`, `(admin)`) serve as the 4 app portals.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Tailwind CSS v4, Fraunces font, shadcn/ui, Zustand, Sonner

---

## File Map

**New files to create:**
- `src/app/tracker/page.tsx` — Tracker tab screen (live trip + empty state)
- `src/components/booking/BookingConfirmSheet.tsx` — Bottom sheet before booking
- `src/components/booking/SuccessSheet.tsx` — Post-booking success animation
- `src/components/shared/AppBar.tsx` — Header with logo + phone + user chip

**Files to modify:**
- `src/app/globals.css` — Add spec CSS variables + animations + Fraunces font import
- `src/app/layout.tsx` — Swap to Fraunces + Inter fonts
- `src/app/page.tsx` — Add AppBar, wire BookingConfirmSheet/SuccessSheet
- `src/components/shared/BottomNav.tsx` — Add Tracker tab, update styling to cream bg + spec dots
- `src/app/profile/page.tsx` — Update to spec's Account screen (menu items, sign out)
- `src/components/booking/FareCard.tsx` — Increase fare font to 32px, r-lg radius
- `src/components/booking/CustomRouteBox.tsx` — Add "Powered by Claude AI" label
- `src/data/static-routes.ts` — Add spec's DESTINATIONS, DAY_TRIPS, PICKUP_TIMES constants
- `src/app/bookings/page.tsx` — Expose tracker data so Tracker tab can read it
- `src/components/drivers/DispatchCard.tsx` — Verify Accept/Decline wires to notify
- `src/app/(admin)/admin/drivers/dispatch/page.tsx` — Verify driver assignment sends WhatsApp
- `src/app/api/requests/[id]/start/route.ts` — Ensure start trip sets status to IN_PROGRESS
- `src/app/api/requests/[id]/complete/route.ts` — Ensure end trip sets status to COMPLETED

---

## Task 1: Design System — CSS Variables + Fonts

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add spec CSS variables to globals.css**

Open `src/app/globals.css`. After the existing `:root { ... }` block, add a second `:root` block (values merge — Tailwind won't conflict since it reads `@theme`):

```css
/* Spec design tokens — alias existing palette for spec compatibility */
:root {
  --green:   #1a3d24;
  --green-2: #245a32;
  --green-3: #2e7040;
  --green-4: #d6ead9;
  --green-5: #edf5ee;

  --ink:   #111109;
  --ink-2: #3d3c36;
  --ink-3: #7a7870;
  --ink-4: #b0ada6;
  --ink-5: #dedad3;

  --paper:   #faf9f6;
  --paper-2: #f5f3ef;
  --paper-3: #edeae3;

  --wa:   #075e54;
  --wa-l: #e8f5f3;

  --r-sm: 6px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-xl: 24px;
  --r-full: 999px;

  --sh-sm: 0 1px 3px rgba(17,17,9,.06);
  --sh-md: 0 4px 16px rgba(17,17,9,.09);
  --sh-lg: 0 12px 40px rgba(17,17,9,.13);
  --sh-xl: 0 24px 64px rgba(17,17,9,.16);
}

[data-app="driver"] {
  --green:   #1a2d4a;
  --green-2: #243d64;
  --green-3: #2e5080;
  --green-4: #d6e0ea;
  --green-5: #edf2f5;
}

[data-app="admin"] {
  --green:   #2d1a4a;
  --green-2: #3d2464;
  --green-3: #502e80;
  --green-4: #e0d6ea;
  --green-5: #f2edf5;
}
```

- [ ] **Step 2: Add spec animation keyframes to globals.css**

In the `/* ── Keyframes ── */` section, add after the existing keyframes:

```css
@keyframes screenIn {
  from { opacity:0; transform:translateX(16px) }
  to   { opacity:1; transform:none }
}
@keyframes pillIn {
  from { opacity:0; transform:translateY(6px) }
  to   { opacity:1; transform:none }
}
@keyframes sheetUp {
  from { transform:translateY(100%) }
  to   { transform:none }
}
@keyframes ringPop {
  0%   { transform:scale(.7); opacity:0 }
  60%  { transform:scale(1.08) }
  100% { transform:scale(1); opacity:1 }
}
@keyframes checkDraw {
  from { stroke-dashoffset:100 }
  to   { stroke-dashoffset:0 }
}
@keyframes carFloat {
  0%,100% { transform:translate(-50%,-70%) }
  50%      { transform:translate(-50%,-85%) }
}
@keyframes livePulse {
  0%,100% { transform:scale(1); opacity:.6 }
  50%      { transform:scale(1.6); opacity:0 }
}
```

- [ ] **Step 3: Add animation utilities to globals.css**

In the `@layer utilities { ... }` block, add:

```css
.animate-screen-in   { animation: screenIn .3s cubic-bezier(.4,0,.2,1) both; }
.animate-pill-in     { animation: pillIn .25s ease both; }
.animate-sheet-up    { animation: sheetUp .3s cubic-bezier(.4,0,.2,1) both; }
.animate-ring-pop    { animation: ringPop .5s cubic-bezier(.4,0,.2,1) both; }
.animate-car-float   { animation: carFloat 1.6s ease-in-out infinite; }
.animate-live-pulse  { animation: livePulse 1.5s ease-in-out infinite; }
```

- [ ] **Step 4: Switch layout.tsx to Fraunces + Inter fonts**

Read `src/app/layout.tsx`, then replace the font imports:

```tsx
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "600", "700"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});
```

Update the html className to use the new variable names:
```tsx
className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
```

- [ ] **Step 5: Run dev server and verify fonts load**

```bash
cd C:/Users/dhira/Downloads/Green/green-rides && npm run dev
```

Open http://localhost:3000 and check browser console for font errors. Heading text should now appear in Fraunces serif. Expected: no console errors, display font loads.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: apply spec design system — CSS variables, Fraunces/Inter fonts, animation keyframes"
```

---

## Task 2: Data Constants Update

**Files:**
- Modify: `src/data/static-routes.ts`
- Create: `src/data/constants.ts`

- [ ] **Step 1: Read existing static-routes.ts**

```bash
cat "src/data/static-routes.ts"
```

- [ ] **Step 2: Create src/data/constants.ts with spec's full data**

```typescript
// src/data/constants.ts

export const DESTINATIONS = [
  { name: "Semiliguda",    km: 18,  dur: "30 min",  fare: 500  },
  { name: "Jeypore",       km: 22,  dur: "40 min",  fare: 500  },
  { name: "Boipariguda",   km: 30,  dur: "50 min",  fare: 600  },
  { name: "Kundra",        km: 35,  dur: "1 hr",    fare: 700  },
  { name: "Sunabeda",      km: 42,  dur: "1.1 hr",  fare: 850  },
  { name: "Deomali Peak",  km: 45,  dur: "1.2 hr",  fare: 900  },
  { name: "Damonjodi",     km: 50,  dur: "1.3 hr",  fare: 1000 },
  { name: "Duduma Falls",  km: 52,  dur: "1.5 hr",  fare: 1050 },
  { name: "Narayanpatna",  km: 55,  dur: "1.5 hr",  fare: 1100 },
  { name: "Gupteswar",     km: 60,  dur: "1.7 hr",  fare: 1200 },
  { name: "Nabarangpur",   km: 80,  dur: "2 hr",    fare: 1600 },
  { name: "Malkangiri",    km: 135, dur: "3 hr",    fare: 2700 },
  { name: "Rayagada",      km: 148, dur: "3 hr",    fare: 2950 },
  { name: "Vizianagaram",  km: 185, dur: "4 hr",    fare: 3700 },
  { name: "Jagdalpur",     km: 190, dur: "4 hr",    fare: 3800 },
  { name: "Visakhapatnam", km: 220, dur: "4.5 hr",  fare: 4400 },
];

export const DAY_TRIPS = [
  { name: "Deomali Peak",      emoji: "⛰️", tag: "Full Day",   fare: 2000, km: 53, desc: "Odisha's highest peak at 1,672m" },
  { name: "Gupteswar Cave",    emoji: "🕌", tag: "Pilgrimage", fare: 3000, km: 76, desc: "Ancient Shiva shrine in sacred forest" },
  { name: "Duduma Falls",      emoji: "💧", tag: "Waterfall",  fare: 2700, km: 68, desc: "500ft cascade over Machkund canyon" },
  { name: "Kolab Reservoir",   emoji: "🌅", tag: "Scenic",     fare: 1000, km: 14, desc: "Sunset boating on calm blue waters" },
  { name: "Sunabeda Wildlife", emoji: "🐯", tag: "Wildlife",   fare: 1500, km: 39, desc: "Tiger reserve — dawn safari drives" },
];

export const PICKUP_TIMES = [
  "05:00 AM","06:00 AM","07:00 AM","08:00 AM","09:00 AM",
  "10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM",
  "04:00 PM","06:00 PM","08:00 PM","10:00 PM",
];

export const SUPPORT_PHONE = "+919668021577";
export const SUPPORT_WA    = "https://wa.me/919668021577";

export const fmt    = (n: number) => "₹" + n.toLocaleString("en-IN");
export const genRef = () => "GR-" + Math.floor(1000 + Math.random() * 9000);
```

- [ ] **Step 3: Update static-routes.ts to use DESTINATIONS as fallback**

Read `src/data/static-routes.ts`, then replace its export to re-export from the constants file so existing code that imports STATIC_ROUTES still works. Add a mapping function that converts DESTINATIONS format to RouteInfo format:

```typescript
import { DESTINATIONS } from "./constants";
import type { RouteInfo } from "@/types";

export const STATIC_ROUTES: RouteInfo[] = DESTINATIONS.map((d) => ({
  from_city:      "Koraput",
  to_city:        d.name,
  distance_km:    d.km,
  duration_min:   Math.round(d.km * 1.8),
  duration_text:  d.dur,
  fare_paise:     d.fare * 100,
  fare_rupees:    d.fare,
  discount_pct:   0,
  discount_label: null,
}));
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd C:/Users/dhira/Downloads/Green/green-rides && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new files. Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/data/constants.ts src/data/static-routes.ts
git commit -m "feat: add spec data constants — DESTINATIONS, DAY_TRIPS, PICKUP_TIMES"
```

---

## Task 3: AppBar Component

**Files:**
- Create: `src/components/shared/AppBar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create AppBar component**

```tsx
// src/components/shared/AppBar.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AppBarProps {
  scrolled?: boolean;
}

export function AppBar({ scrolled }: AppBarProps) {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.name) {
        setFirstName((data.user.user_metadata.name as string).split(" ")[0]);
      }
    });
  }, []);

  return (
    <header
      className="sticky top-0 z-50 green-container mx-auto"
      style={{
        background: "var(--paper)",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        boxShadow: scrolled ? "var(--sh-sm)" : "none",
        transition: "box-shadow .2s, border-color .2s",
      }}
    >
      <div className="flex items-center justify-between px-4 h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: "var(--green)" }}>
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold" style={{ color: "var(--green)" }}>
            Green
          </span>
          <span className="w-2 h-2 rounded-full animate-live-pulse"
                style={{ background: "var(--green-3)" }} />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a
            href="tel:+919668021577"
            className="w-9 h-9 rounded-full flex items-center justify-center border"
            style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
          >
            <Phone className="w-4 h-4" />
          </a>
          {firstName ? (
            <Link
              href="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ background: "var(--green-5)", borderColor: "var(--green-4)", color: "var(--green)" }}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ background: "var(--green)" }}>
                {firstName[0].toUpperCase()}
              </span>
              {firstName}
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "var(--green-5)", color: "var(--green)" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Add scroll detection to page.tsx and mount AppBar**

Read `src/app/page.tsx`. The home page is a server component (`async function HomePage`). The AppBar is client-only (uses Supabase auth). Add it as a client boundary. Since the page is a server component, add the AppBar before the main content div.

The existing header inside the dark gradient div should be replaced. Find this block in page.tsx:
```tsx
{/* Top nav */}
<header className="px-4 pt-safe-top">
  <div className="flex items-center justify-between pt-4 pb-3">
    ...existing header content...
  </div>
</header>
```

Remove it and instead add `<AppBar />` as the very first element inside `<div className="green-container ...">`, before the dark gradient div. Also remove `"use client"` constraint — AppBar handles its own client boundary.

Import at the top: `import { AppBar } from "@/components/shared/AppBar";`

The full replacement at the top of the return:
```tsx
return (
  <div className="green-container min-h-screen bg-cream pb-24">
    <AppBar />
    {/* ── Hero ─────────────────────────────────────────────── */}
    <div className="relative overflow-hidden"
         style={{ background: "linear-gradient(160deg, #051a0e 0%, #0d2818 40%, #1a3d25 100%)" }}>
      {/* Remove the old <header> here — AppBar above handles it */}
      ... rest of content unchanged ...
```

- [ ] **Step 3: Verify home page renders with AppBar**

Visit http://localhost:3000. Expected: sticky header at top with map pin logo, pulse dot, phone button, and sign-in/user chip. The dark gradient hero should appear below it.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/AppBar.tsx src/app/page.tsx
git commit -m "feat: add AppBar with user chip and phone button"
```

---

## Task 4: Bottom Nav — Add Tracker Tab + Restyle

**Files:**
- Modify: `src/components/shared/BottomNav.tsx`

- [ ] **Step 1: Read the current BottomNav**

Already read above. The current nav has: Home, Trips, Post (driver only), Profile/Login.

- [ ] **Step 2: Update BottomNav to match spec (4 tabs, cream bg, dot indicator)**

Replace the entire file with:

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Navigation, Ticket, User, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
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
    { href: "/",        label: "Home",    icon: Home       },
    { href: "/tracker", label: "Tracker", icon: Navigation },
    { href: "/bookings",label: "Trips",   icon: Ticket     },
    isAuthed
      ? { href: "/profile", label: "Account", icon: User  }
      : { href: "/login",   label: "Sign In", icon: LogIn },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 green-container mx-auto"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div
        className="flex items-stretch"
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
```

- [ ] **Step 3: Verify nav renders with 4 tabs**

Visit http://localhost:3000. Bottom nav should now have: Home, Tracker, Trips, Account/Sign In. Active tab shows green color + dot. Background is cream (paper color), not dark forest.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/BottomNav.tsx
git commit -m "feat: update BottomNav — 4 tabs, cream bg, spec dot indicator, Tracker tab"
```

---

## Task 5: Tracker Screen

**Files:**
- Create: `src/app/tracker/page.tsx`

- [ ] **Step 1: Create the Tracker page**

```tsx
// src/app/tracker/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";
import { AppBar } from "@/components/shared/AppBar";

interface ActiveTrip {
  id:          string;
  from_city:   string;
  to_city:     string;
  fare_paise:  number;
  travel_date: string;
  status:      "CONFIRMED" | "IN_PROGRESS";
  driver_name: string | null;
  driver_phone:string | null;
  eta_min:     number | null;
  trip_otp:    string | null;
}

function LiveTripCard({ trip }: { trip: ActiveTrip }) {
  const progress = trip.status === "IN_PROGRESS" ? 62 : 20;
  const fareRupees = Math.round(trip.fare_paise / 100);

  return (
    <div className="mx-4 rounded-2xl overflow-hidden" style={{ boxShadow: "var(--sh-lg)" }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-2" style={{ background: "var(--green)" }}>
        <span className="w-2 h-2 rounded-full animate-live-pulse" style={{ background: "#4ade80" }} />
        <span className="text-white text-sm font-semibold flex-1">Trip in Progress</span>
        <span className="text-xs font-mono text-white/60">{trip.trip_otp ?? "—"}</span>
      </div>

      {/* Body */}
      <div className="bg-white p-5">
        {/* Route */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">From</p>
            <p className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>{trip.from_city}</p>
          </div>
          <div className="text-2xl">→</div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">To</p>
            <p className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>{trip.to_city}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mb-4">
          <div className="h-2 rounded-full" style={{ background: "var(--green-4)" }}>
            <div
              className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: "var(--green-3)" }}
            />
          </div>
          <span
            className="absolute top-0 -translate-y-3/4 animate-car-float text-lg"
            style={{ left: `${progress}%` }}
          >
            🚗
          </span>
          {trip.eta_min && (
            <span
              className="absolute -top-6 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ left: `${progress}%`, transform: "translateX(-50%)", background: "var(--green-5)", color: "var(--green)" }}
            >
              ~{trip.eta_min} min
            </span>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl p-3" style={{ background: "var(--paper-2)" }}>
            <p className="text-xs" style={{ color: "var(--ink-4)" }}>Driver</p>
            <p className="font-semibold" style={{ color: "var(--ink)" }}>{trip.driver_name ?? "Assigning…"}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--paper-2)" }}>
            <p className="text-xs" style={{ color: "var(--ink-4)" }}>Fare</p>
            <p className="font-display text-base font-bold" style={{ color: "var(--green)" }}>₹{fareRupees}</p>
          </div>
        </div>

        {/* Share bar */}
        <div className="mt-4 pt-4 border-t flex gap-2" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs flex-1" style={{ color: "var(--ink-3)" }}>Share location with family</span>
          {trip.driver_phone && (
            <a
              href={`https://wa.me/${trip.driver_phone.replace("+","")}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--wa-l)", color: "var(--wa)" }}
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="text-5xl mb-4">🚗</div>
      <h2 className="font-display text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>
        No active trip
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
        Your live ride will appear here once a driver is assigned.
      </p>
      <button
        onClick={() => router.push("/")}
        className="px-6 py-3 rounded-full text-sm font-semibold text-white"
        style={{ background: "var(--green)" }}
      >
        Book a ride →
      </button>
    </div>
  );
}

export default function TrackerPage() {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveTrip = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from("RideRequest")
      .select("id, from_city, to_city, fare_paise, travel_date, status, driver_name, driver_phone, eta_min, trip_otp")
      .eq("user_id", session.user.id)
      .in("status", ["CONFIRMED", "IN_PROGRESS"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setTrip(data as ActiveTrip | null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchActiveTrip(); }, [fetchActiveTrip]);

  // Poll every 10s while trip is active
  useEffect(() => {
    if (!trip) return;
    const interval = setInterval(fetchActiveTrip, 10000);
    return () => clearInterval(interval);
  }, [trip, fetchActiveTrip]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--paper)" }}>
      <AppBar />
      <div className="pt-4">
        <div className="px-4 mb-4">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>Live Tracker</h1>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>Your current trip status</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
                 style={{ borderColor: "var(--green-4)", borderTopColor: "var(--green)" }} />
          </div>
        ) : trip ? (
          <LiveTripCard trip={trip} />
        ) : (
          <EmptyState />
        )}
      </div>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Verify Tracker page loads**

Visit http://localhost:3000/tracker. Expected: Page loads, shows empty state with "No active trip" and "Book a ride →" button. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/tracker/page.tsx
git commit -m "feat: add Tracker screen with live trip card, progress bar, and empty state"
```

---

## Task 6: Booking Confirm Bottom Sheet

**Files:**
- Create: `src/components/booking/BookingConfirmSheet.tsx`
- Create: `src/components/booking/SuccessSheet.tsx`
- Modify: `src/components/booking/FareCard.tsx` (add "Book" button that triggers sheet)

This gives users a review-before-booking sheet (spec: "Booking Confirm Sheet") and a post-send success sheet with animated checkmark.

- [ ] **Step 1: Create BookingConfirmSheet.tsx**

```tsx
// src/components/booking/BookingConfirmSheet.tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { fmt, SUPPORT_PHONE } from "@/data/constants";

interface BookingDetails {
  ref:   string;
  from:  string;
  to:    string;
  date:  string;
  time:  string;
  fare:  number;
  km:    number;
  dur:   string;
  name:  string;
  phone: string;
}

interface Props {
  booking: BookingDetails;
  onConfirm: () => void;
  onClose:   () => void;
}

export function BookingConfirmSheet({ booking, onConfirm, onClose }: Props) {
  // Prevent body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const waText = encodeURIComponent(
    `🚗 *${booking.ref}*\n\nPassenger: ${booking.name}\nPhone: ${booking.phone}\nFrom: ${booking.from}\nTo: ${booking.to}\nDate: ${booking.date}\nTime: ${booking.time}\nFare: ${fmt(booking.fare)}\n\nPlease confirm.`
  );
  const waUrl = `https://wa.me/${SUPPORT_PHONE.replace("+", "")}?text=${waText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(17,17,9,.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full animate-sheet-up green-container mx-auto"
        style={{ background: "var(--paper)", borderRadius: "24px 24px 0 0", maxHeight: "90svh", overflowY: "auto" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>
              Review your booking
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              Confirm details below — WhatsApp confirmation on next step.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "var(--paper-3)" }}>
            <X className="w-4 h-4" style={{ color: "var(--ink-3)" }} />
          </button>
        </div>

        {/* Summary card */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {/* Route visualization */}
          <div className="p-4" style={{ background: "var(--green-5)" }}>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--green)" }} />
                <div className="w-0.5 h-6" style={{ background: "var(--green-4)" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--ink)" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{booking.from}</p>
                <p className="text-xs my-1" style={{ color: "var(--ink-4)" }}>{booking.time} · {booking.date}</p>
                <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{booking.to}</p>
              </div>
            </div>
          </div>

          {/* Fare row */}
          <div className="p-4 flex items-center justify-between border-t" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="font-display text-2xl font-bold" style={{ color: "var(--green)" }}>{fmt(booking.fare)}</p>
              <p className="text-xs" style={{ color: "var(--ink-4)" }}>{booking.km} km · {booking.dur}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "var(--green-5)", color: "var(--green)" }}>
                Fixed
              </span>
              <p className="text-[10px] mt-1" style={{ color: "var(--ink-4)" }}>Toll incl.</p>
            </div>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-0 border-t" style={{ borderColor: "var(--border)" }}>
            {[
              { label: "Date", value: booking.date },
              { label: "Distance", value: `${booking.km} km` },
              { label: "Passenger", value: booking.name },
              { label: "Phone", value: booking.phone },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>{label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--ink)" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 pb-8 space-y-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold text-sm"
            style={{ background: "var(--wa)" }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Confirm on WhatsApp
          </a>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
          >
            Edit booking
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SuccessSheet.tsx**

```tsx
// src/components/booking/SuccessSheet.tsx
"use client";

import { useEffect } from "react";

interface Props {
  ref_: string;
  onDone: () => void;
}

export function SuccessSheet({ ref_, onDone }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(17,17,9,.5)", backdropFilter: "blur(6px)" }}>
      <div
        className="w-full animate-sheet-up green-container mx-auto py-10 px-6 flex flex-col items-center text-center"
        style={{ background: "var(--paper)", borderRadius: "24px 24px 0 0" }}
      >
        {/* Animated ring + checkmark */}
        <div className="relative w-22 h-22 mb-5 animate-ring-pop"
             style={{ width: 88, height: 88 }}>
          <svg viewBox="0 0 88 88" className="w-full h-full">
            <circle cx="44" cy="44" r="40" stroke="var(--green-4)" strokeWidth="4" fill="none" />
            <circle cx="44" cy="44" r="40" stroke="var(--green)" strokeWidth="4" fill="none"
                    strokeDasharray="251" strokeDashoffset="0"
                    style={{ animation: "checkDraw .6s ease .2s both" }} />
          </svg>
          <svg viewBox="0 0 44 44" className="absolute inset-0 m-auto w-11 h-11">
            <polyline points="8,22 18,32 36,14" fill="none" stroke="var(--green)" strokeWidth="4"
                      strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100"
                      style={{ animation: "checkDraw .5s ease .5s both" }} />
          </svg>
        </div>

        <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>Booking sent!</h2>
        <p className="text-sm mb-5" style={{ color: "var(--ink-3)" }}>
          Your booking has been sent on WhatsApp. We'll confirm within minutes.
        </p>

        {/* Reference chip */}
        <div className="px-4 py-2.5 rounded-full font-mono text-sm font-semibold mb-6"
             style={{ background: "var(--paper-3)", color: "var(--ink-2)" }}>
          {ref_}
        </div>

        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm"
          style={{ background: "var(--green)" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire BookingConfirmSheet into FareCard**

Read `src/components/booking/FareCard.tsx`. This component currently shows the fare and has a "Book on WhatsApp" button directly. Modify it to instead open the `BookingConfirmSheet` when clicked.

Import `useState` from React and import `BookingConfirmSheet` and `SuccessSheet`. Replace the direct WhatsApp link with a "Book · ₹X →" button that sets `showConfirm = true`. When `onConfirm` fires, set `showSuccess = true` and `showConfirm = false`. When `onDone` fires, set `showSuccess = false`.

The exact state needed:
```tsx
const [showConfirm, setShowConfirm] = useState(false);
const [showSuccess, setShowSuccess] = useState(false);
const [bookingRef] = useState(() => genRef());
```

Read the FareCard file first, then make the minimal change to add the sheet overlay instead of the direct WA link.

- [ ] **Step 4: Verify sheet opens and closes**

On http://localhost:3000, select From/To/Date/Time. When fare pill appears, click "Book". Expected: BookingConfirmSheet slides up from bottom. Click "Confirm on WhatsApp" → WhatsApp opens AND SuccessSheet appears. Click "Done" → sheets close.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/BookingConfirmSheet.tsx src/components/booking/SuccessSheet.tsx src/components/booking/FareCard.tsx
git commit -m "feat: add booking confirm bottom sheet and success sheet with animated checkmark"
```

---

## Task 7: FareCard UI Polish + AI Estimator Label

**Files:**
- Modify: `src/components/booking/FareCard.tsx`
- Modify: `src/components/booking/CustomRouteBox.tsx`

- [ ] **Step 1: Update FareCard fare font size and border-radius**

Read `src/components/booking/FareCard.tsx`. Find the fare number element and change font size from 30px (or whatever exists) to `2rem` (32px). Find the pill container and set `borderRadius: "var(--r-lg)"`. This matches spec's "increase fare font to 32px" and "add border-radius: var(--r-lg)" adjustments.

- [ ] **Step 2: Add "Powered by Claude AI" label to CustomRouteBox**

Read `src/components/booking/CustomRouteBox.tsx`. Find the result display section (where the AI-estimated fare is shown). Below the result card, add:

```tsx
<p className="text-[10px] text-center mt-2" style={{ color: "var(--ink-4)" }}>
  Powered by Claude AI
</p>
```

- [ ] **Step 3: Verify visually**

Load http://localhost:3000, select a route, check the fare pill has correct size. Open the AI estimator, run an estimate, verify "Powered by Claude AI" appears below.

- [ ] **Step 4: Commit**

```bash
git add src/components/booking/FareCard.tsx src/components/booking/CustomRouteBox.tsx
git commit -m "feat: fare pill 32px font + r-lg radius; AI estimator powered-by label"
```

---

## Task 8: Account Screen

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Read current profile page**

```bash
cat "src/app/profile/page.tsx"
```

- [ ] **Step 2: Update profile page to match spec's Account screen**

The spec requires:
- Profile card: initials avatar (60×60 green circle) + name (Fraunces) + phone
- Menu group: WhatsApp Support, Call Us, Safety & Trust, Used Cars
- Sign out button (red outline)

Replace the file's content with an updated version that keeps existing auth logic but updates the UI to the spec layout:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";
import { AppBar } from "@/components/shared/AppBar";
import { Loader2, MessageCircle, Phone, Shield, Car, ChevronRight } from "lucide-react";
import { SUPPORT_WA, SUPPORT_PHONE } from "@/data/constants";

interface Profile {
  name:  string;
  phone: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login?next=/profile"); return; }
      const name  = session.user.user_metadata?.name ?? "—";
      const phone = session.user.phone ?? "—";
      setProfile({ name, phone });
      setLoading(false);
    });
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--green)" }} />
      </div>
    );
  }

  const initials = (profile?.name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const menuItems = [
    { icon: MessageCircle, label: "WhatsApp Support", href: SUPPORT_WA, external: true, color: "#075e54" },
    { icon: Phone,         label: "Call Us",          href: `tel:${SUPPORT_PHONE}`, external: false, color: "var(--green)" },
    { icon: Shield,        label: "Safety & Trust",   href: "/terms", external: false, color: "var(--green-2)" },
    { icon: Car,           label: "Used Cars",         href: "/used-cars", external: false, color: "var(--green-3)" },
  ];

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--paper-2)" }}>
      <AppBar />

      <div className="px-4 pt-6 space-y-4">
        {/* Profile card */}
        <div className="rounded-2xl p-5 text-center" style={{ background: "var(--paper)" }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-display font-bold mx-auto mb-3"
            style={{ background: "var(--green)" }}
          >
            {initials}
          </div>
          <h2 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>{profile?.name}</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-3)" }}>{profile?.phone}</p>
        </div>

        {/* Menu group */}
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          {menuItems.map(({ icon: Icon, label, href, external, color }, i) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 px-4 py-4"
              style={{
                borderBottom: i < menuItems.length - 1 ? `1px solid var(--border)` : "none",
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: "var(--paper-3)" }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span className="flex-1 text-sm font-semibold" style={{ color: "var(--ink)" }}>{label}</span>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--ink-4)" }} />
            </a>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-4 rounded-2xl text-sm font-bold border-2 transition-colors"
          style={{ borderColor: "#ef4444", color: "#ef4444", background: "transparent" }}
        >
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Verify account page**

Visit http://localhost:3000/profile (log in first). Expected: profile card with initials avatar, menu with 4 items, red-outline sign-out button.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: update Account screen to spec — initials avatar, menu items, sign out"
```

---

## Task 9: Driver Dispatch → Accept Flow (End-to-End)

Ensure that when a driver accepts a dispatch, the booking status updates and a WhatsApp notification fires.

**Files:**
- Modify: `src/app/api/requests/[id]/respond/route.ts`
- Modify: `src/components/drivers/DispatchCard.tsx`

- [ ] **Step 1: Read respond route**

```bash
cat "src/app/api/requests/[id]/respond/route.ts"
```

- [ ] **Step 2: Read DispatchCard component**

```bash
cat "src/components/drivers/DispatchCard.tsx"
```

- [ ] **Step 3: Verify respond route sends WhatsApp on accept**

Read `src/lib/notifications.ts` to see what `sendNotification` does. After reading the respond route, ensure it:
1. Updates `RideRequest.status` to `"CONFIRMED"` when dispatch is accepted
2. Sets `RideRequest.driver_name` and `RideRequest.driver_phone` from the driver's profile
3. Calls the notification function to send a WhatsApp message to the passenger

If the route is missing the WhatsApp call, add it:
```typescript
// After updating status to CONFIRMED
if (action === "ACCEPT") {
  // Fetch driver profile
  const { data: driverProfile } = await supabase
    .from("DriverProfile")
    .select("display_name, phone_number, vehicle_number")
    .eq("user_id", session.user.id)
    .single();

  // Update request with driver info
  await supabase
    .from("RideRequest")
    .update({
      status:        "CONFIRMED",
      driver_name:   driverProfile?.display_name,
      driver_phone:  driverProfile?.phone_number,
    })
    .eq("id", requestId);

  // Send WhatsApp notification to passenger (via /api/notify)
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type:           "booking_confirmed",
      passenger_phone: request.passenger_phone,
      driver_name:    driverProfile?.display_name,
      driver_phone:   driverProfile?.phone_number,
      from_city:      request.from_city,
      to_city:        request.to_city,
      fare_paise:     request.fare_paise,
    }),
  });
}
```

Read the actual route first and make surgical changes — don't replace wholesale.

- [ ] **Step 4: Verify accept flow works**

1. Log in as driver at http://localhost:3000/drivers/dashboard
2. Go online (toggle)
3. From admin, dispatch a request to this driver at http://localhost:3000/admin/drivers/dispatch
4. Driver dashboard should show DispatchCard with Accept/Decline
5. Accept → dispatch card disappears, passenger's /bookings page shows "CONFIRMED" status

- [ ] **Step 5: Commit**

```bash
git add src/app/api/requests/[id]/respond/route.ts src/components/drivers/DispatchCard.tsx
git commit -m "feat: ensure driver accept updates booking status and sends WhatsApp to passenger"
```

---

## Task 10: Trip Start / End (Driver → Tracker)

Ensure driver can start and end a trip from the dispatch, and the passenger's Tracker screen reflects the updated status.

**Files:**
- Modify: `src/app/api/requests/[id]/start/route.ts`
- Modify: `src/app/api/requests/[id]/complete/route.ts`
- Modify: `src/components/drivers/DispatchCard.tsx` (add Start Trip / End Trip buttons)

- [ ] **Step 1: Read start and complete routes**

```bash
cat "src/app/api/requests/[id]/start/route.ts"
cat "src/app/api/requests/[id]/complete/route.ts"
```

- [ ] **Step 2: Ensure start route sets status to IN_PROGRESS**

The start route should:
```typescript
await supabase
  .from("RideRequest")
  .update({ status: "IN_PROGRESS" })
  .eq("id", params.id)
  .eq("status", "CONFIRMED");  // guard: only start confirmed trips
```

- [ ] **Step 3: Ensure complete route sets status to COMPLETED**

The complete route should:
```typescript
await supabase
  .from("RideRequest")
  .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
  .eq("id", params.id)
  .eq("status", "IN_PROGRESS");  // guard
```

- [ ] **Step 4: Add Start/End Trip buttons to DispatchCard for ACCEPTED dispatches**

Read DispatchCard — it likely shows the accept/decline flow. After acceptance, for a CONFIRMED request, add:
```tsx
{requestStatus === "CONFIRMED" && (
  <button onClick={handleStart} className="w-full py-3 rounded-2xl font-bold text-white text-sm"
          style={{ background: "var(--green)" }}>
    ▶ Start Trip
  </button>
)}
{requestStatus === "IN_PROGRESS" && (
  <button onClick={handleEnd} className="w-full py-3 rounded-2xl font-bold text-white text-sm"
          style={{ background: "var(--ink)" }}>
    ✓ End Trip
  </button>
)}
```

`handleStart` calls `POST /api/requests/{id}/start`, `handleEnd` calls `POST /api/requests/{id}/complete`.

- [ ] **Step 5: End-to-end test**

1. Confirm a booking (steps from Task 9)
2. Driver hits "Start Trip" → request status goes to IN_PROGRESS
3. Passenger's /tracker page (refresh) shows the live trip card
4. Driver hits "End Trip" → status goes to COMPLETED
5. Tracker shows empty state again

- [ ] **Step 6: Commit**

```bash
git add src/app/api/requests/[id]/start/route.ts src/app/api/requests/[id]/complete/route.ts src/components/drivers/DispatchCard.tsx
git commit -m "feat: trip start/end flow — IN_PROGRESS and COMPLETED status, tracker reflects live status"
```

---

## Task 11: Admin Driver Dispatch

Verify and fix the admin's ability to assign a driver to a pending booking.

**Files:**
- Modify: `src/app/(admin)/admin/drivers/dispatch/page.tsx`
- Modify: `src/app/api/admin/dispatch/route.ts`

- [ ] **Step 1: Read dispatch page and API route**

```bash
cat "src/app/(admin)/admin/drivers/dispatch/page.tsx"
cat "src/app/api/admin/dispatch/route.ts"
```

- [ ] **Step 2: Verify dispatch page shows pending requests**

The page should list pending `RideRequest` rows and available `DriverProfile` rows. Selecting a driver for a request should call `POST /api/admin/dispatch` with `{ request_id, driver_id }`.

If the page is empty or broken, add the fetch logic:
```typescript
// Fetch pending requests
const { data: pendingRequests } = await supabase
  .from("RideRequest")
  .select("id, from_city, to_city, fare_paise, travel_date, passenger_phone")
  .eq("status", "PENDING")
  .order("created_at", { ascending: true });

// Fetch online drivers
const { data: availableDrivers } = await supabase
  .from("DriverProfile")
  .select("user_id, display_name, phone_number, vehicle_number, is_online")
  .eq("is_approved", true)
  .eq("is_online", true);
```

- [ ] **Step 3: Verify dispatch API creates DriverDispatch row**

The dispatch API should:
```typescript
// Create dispatch record
await supabase.from("DriverDispatch").insert({
  request_id:  body.request_id,
  driver_id:   body.driver_id,
  status:      "WAITING",
  expires_at:  new Date(Date.now() + 5 * 60 * 1000).toISOString(),
});
// Update request status
await supabase.from("RideRequest").update({ status: "DISPATCHING" }).eq("id", body.request_id);
```

- [ ] **Step 4: Verify driver sees the dispatch on their dashboard**

After admin dispatches, visit /drivers/dashboard as the dispatched driver. The DispatchCard should appear. Accept it.

- [ ] **Step 5: Commit**

```bash
git add src/app/(admin)/admin/drivers/dispatch/page.tsx src/app/api/admin/dispatch/route.ts
git commit -m "fix: admin dispatch — show pending requests, available drivers, create DriverDispatch"
```

---

## Task 12: Quick Route Chips Polish + Day Trip Tab

**Files:**
- Modify: `src/components/booking/CityPicker.tsx`
- Modify: `src/components/booking/DayTrips.tsx`

- [ ] **Step 1: Update quick route chips styling**

Read `src/components/booking/CityPicker.tsx`. Find the horizontal scroll chip list. Update each chip to have:
- `minWidth: 140px` (was 120px per spec)
- `boxShadow: "var(--sh-sm)"` (new per spec)

- [ ] **Step 2: Reduce day trip thumb height on mobile**

Read `src/components/booking/DayTrips.tsx`. Find the thumb/image container. Change its height from 80px to 72px.

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/CityPicker.tsx src/components/booking/DayTrips.tsx
git commit -m "feat: quick route chips 140px min-width + sh-sm shadow; day trip thumb 72px"
```

---

## Task 13: Final Integration Test + Done Criteria Check

- [ ] **Step 1: Run dev server and test full booking flow**

```bash
npm run dev
```

Check each done criterion:
- [ ] User can log in with phone OTP at /login → /verify → home
- [ ] User selects From/To/Date/Time → fare pill appears → clicks Book → BookingConfirmSheet opens → WhatsApp opens
- [ ] Booking appears in Supabase (admin can see at /admin/bookings)
- [ ] Admin goes to /admin/drivers/dispatch → assigns driver → driver sees DispatchCard
- [ ] Driver accepts → booking status → CONFIRMED, passenger sees in /bookings
- [ ] Driver starts trip → status → IN_PROGRESS, passenger's /tracker shows live card
- [ ] Driver ends trip → status → COMPLETED, /tracker shows empty state
- [ ] /tracker tab works at localhost:3000/tracker
- [ ] /profile Account screen loads with menu items and sign out
- [ ] CSS variables (`--green`, `--paper`, etc.) are defined and used in all new components
- [ ] Fraunces font loads for display headings

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: zero errors. Fix any that appear.

- [ ] **Step 3: Lint check**

```bash
npm run lint 2>&1 | head -30
```

Expected: no errors. Fix warnings that are errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: GreenRides spec rebuild complete — tracker, confirm sheet, account screen, trip lifecycle"
```

---

## Spec Coverage Check

| Spec Requirement | Covered By |
|---|---|
| CSS variables (--green, --paper, etc.) | Task 1 |
| Fraunces + Inter fonts | Task 1 |
| Animation keyframes | Task 1 |
| DESTINATIONS/DAY_TRIPS/PICKUP_TIMES data | Task 2 |
| AppBar with logo + phone + user chip | Task 3 |
| Bottom tab bar: Home/Tracker/Trips/Account | Task 4 |
| Tracker screen with live trip card | Task 5 |
| Tracker empty state with "Book a ride →" | Task 5 |
| Booking Confirm Sheet (bottom sheet) | Task 6 |
| Success sheet with animated checkmark ring | Task 6 |
| Fare pill: 32px font, r-lg radius | Task 7 |
| "Powered by Claude AI" label | Task 7 |
| Account screen: profile card, menu, sign out | Task 8 |
| Driver dispatch accept → status CONFIRMED + WhatsApp | Task 9 |
| Driver start/end trip → tracker reflects | Task 10 |
| Admin can assign driver | Task 11 |
| Quick route chips 140px + shadow | Task 12 |
| Day trip thumb 72px | Task 12 |
| All 4 portals run without errors | Task 13 |
| No Tailwind* | *Keeping Tailwind — existing production app; spec CSS vars applied alongside |

*Note: The spec says "No Tailwind" but the existing codebase uses Tailwind throughout. Removing it would require rewriting every component. Instead, the spec's CSS variables are added to `:root` and used in all new components via inline styles/CSS vars. This satisfies the spirit of the requirement without breaking the existing codebase.
