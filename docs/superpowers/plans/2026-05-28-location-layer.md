# Location Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Driver GPS pings every 10s during IN_PROGRESS trips; riders see a live Mapbox map of the driver's position.

**Architecture:** `DriverLocation` table (one row per active trip, upserted); driver app posts lat/lng to `POST /api/location/ping`; Supabase Realtime broadcasts UPDATEs to the rider's browser; `LiveMap` component (Mapbox GL JS, `ssr: false`) renders a moving driver pin inside the existing `ConfirmedHeroCard`.

**Tech Stack:** Next.js 16 App Router, Supabase JS client (Realtime + service-role), `mapbox-gl`, `@types/mapbox-gl`, Zod, existing Bearer-token auth pattern, `NEXT_PUBLIC_MAPBOX_TOKEN` env var.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/009_driver_location.sql` | DriverLocation table, RLS, Realtime publication |
| Create | `src/app/api/location/ping/route.ts` | POST — driver upserts current position |
| Create | `src/app/api/location/[requestId]/route.ts` | GET — rider fetches initial position on map mount |
| Create | `src/components/shared/LiveMap.tsx` | Mapbox GL component, Realtime subscriber |
| Modify | `src/app/api/requests/[id]/complete/route.ts` | Delete DriverLocation row on trip complete |
| Modify | `src/app/(fleet)/fleet/today/page.tsx` | GPS ping loop + "Sharing location" chip |
| Modify | `src/app/bookings/page.tsx` | Dynamic LiveMap import, pass token to ConfirmedHeroCard |
| Modify | `next.config.ts` | Add `transpilePackages: ['mapbox-gl']` |

---

## Task 1: Install packages, migration, next.config

**Files:**
- Modify: `next.config.ts`
- Create: `supabase/migrations/009_driver_location.sql`

- [ ] **Step 1: Install mapbox-gl and types**

```bash
npm install mapbox-gl
npm install -D @types/mapbox-gl
```

Expected: both packages appear in `package.json`. No errors.

- [ ] **Step 2: Add transpilePackages to next.config.ts**

Full file content after edit:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl"],
};

export default nextConfig;
```

- [ ] **Step 3: Create the migration file**

Create `supabase/migrations/009_driver_location.sql` with this exact content:

```sql
-- Phase 5: Live driver location tracking.

CREATE TABLE IF NOT EXISTS "DriverLocation" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT        UNIQUE NOT NULL,
  driver_id   TEXT        NOT NULL,
  lat         FLOAT8      NOT NULL,
  lng         FLOAT8      NOT NULL,
  heading     FLOAT4,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DriverLocation_driver_idx"  ON "DriverLocation" (driver_id);

ALTER TABLE "DriverLocation" ENABLE ROW LEVEL SECURITY;

-- Driver can write their own row
CREATE POLICY IF NOT EXISTS "location_driver_write" ON "DriverLocation"
  FOR ALL
  USING   (driver_id = auth.uid()::text)
  WITH CHECK (driver_id = auth.uid()::text);

-- Rider can read the location for their own request
CREATE POLICY IF NOT EXISTS "location_rider_read" ON "DriverLocation"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "RideRequest"
      WHERE id = request_id
        AND rider_id = auth.uid()::text
    )
  );

-- Enable Realtime publication so Supabase broadcasts row changes
ALTER PUBLICATION supabase_realtime ADD TABLE "DriverLocation";
```

- [ ] **Step 4: Verify the build still compiles**

```bash
npx tsc --noEmit
```

Expected: same errors as before (pre-existing ones in admin/documents). No new errors from the mapbox-gl types.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts supabase/migrations/009_driver_location.sql package.json package-lock.json
git commit -m "feat(location): install mapbox-gl, add DriverLocation migration"
```

---

## Task 2: Ping API endpoint

**Files:**
- Create: `src/app/api/location/ping/route.ts`

- [ ] **Step 1: Smoke test — verify 401 before implementation**

```bash
curl -s -X POST http://localhost:3000/api/location/ping \
  -H "Content-Type: application/json" \
  -d '{"request_id":"00000000-0000-0000-0000-000000000000","lat":12.9,"lng":77.5}' | cat
```

Expected: 404 (route doesn't exist yet). This confirms the baseline.

- [ ] **Step 2: Create the route**

Create `src/app/api/location/ping/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  request_id: z.string().uuid(),
  lat:        z.number().min(-90).max(90),
  lng:        z.number().min(-180).max(180),
  heading:    z.number().min(0).max(360).optional(),
});

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { request_id, lat, lng, heading } = parsed.data;

  // Verify driver has an ACCEPTED dispatch for this request
  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", request_id)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) {
    return Response.json({ error: "No active dispatch found" }, { status: 403 });
  }

  // Verify request is IN_PROGRESS
  const { data: request } = await db
    .from("RideRequest")
    .select("status")
    .eq("id", request_id)
    .eq("status", "IN_PROGRESS")
    .maybeSingle();

  if (!request) {
    return Response.json({ error: "Trip not in progress" }, { status: 403 });
  }

  await db.from("DriverLocation").upsert(
    {
      request_id,
      driver_id:  user.id,
      lat,
      lng,
      heading:    heading ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "request_id" }
  );

  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Verify 401 on unauthenticated call**

```bash
curl -s -X POST http://localhost:3000/api/location/ping \
  -H "Content-Type: application/json" \
  -d '{"request_id":"00000000-0000-0000-0000-000000000000","lat":12.9,"lng":77.5}' | cat
```

Expected: `{"error":"Unauthorized"}` with status 401.

- [ ] **Step 4: Verify 400 on bad body**

```bash
curl -s -X POST http://localhost:3000/api/location/ping \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token" \
  -d '{"lat":200}' | cat
```

Expected: 401 (bad token) or 400 (bad body shape). Either confirms validation is active.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/location/ping/route.ts
git commit -m "feat(location): add POST /api/location/ping endpoint"
```

---

## Task 3: GET location endpoint

**Files:**
- Create: `src/app/api/location/[requestId]/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/location/[requestId]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await params;

  // Verify caller is the rider on this request
  const { data: rideRequest } = await db
    .from("RideRequest")
    .select("id")
    .eq("id", requestId)
    .eq("rider_id", user.id)
    .maybeSingle();

  if (!rideRequest) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: location } = await db
    .from("DriverLocation")
    .select("lat, lng, heading, updated_at")
    .eq("request_id", requestId)
    .maybeSingle();

  return Response.json({ data: location ?? null, error: null });
}
```

- [ ] **Step 2: Verify 401 on unauthenticated call**

```bash
curl -s http://localhost:3000/api/location/00000000-0000-0000-0000-000000000000 | cat
```

Expected: `{"error":"Unauthorized"}`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/location/[requestId]/route.ts"
git commit -m "feat(location): add GET /api/location/:requestId endpoint"
```

---

## Task 4: Cleanup DriverLocation on trip complete

**Files:**
- Modify: `src/app/api/requests/[id]/complete/route.ts`

The current file (lines 29–55) updates RideRequest to COMPLETED and increments total_trips. Add a DriverLocation delete after the status update succeeds.

- [ ] **Step 1: Add the delete call**

After the `if (error)` check block (currently line 37), insert:

```typescript
  // Clean up location row — no stale pin for completed trips
  await db.from("DriverLocation").delete().eq("request_id", requestId);
```

Full file after edit:

```typescript
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;

  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id")
    .eq("request_id", requestId)
    .eq("driver_id", user.id)
    .eq("status", "ACCEPTED")
    .maybeSingle();

  if (!dispatch) {
    return Response.json({ error: "Not authorized or request not in accepted state" }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { error } = await db
    .from("RideRequest")
    .update({ status: "COMPLETED", completed_at: now, updated_at: now })
    .eq("id", requestId)
    .eq("status", "IN_PROGRESS");

  if (error) {
    console.error("[requests/complete]", error);
    return Response.json({ error: "Failed to complete request" }, { status: 500 });
  }

  // Clean up location row — no stale pin for completed trips
  await db.from("DriverLocation").delete().eq("request_id", requestId);

  const { data: profile } = await db
    .from("DriverProfile")
    .select("total_trips")
    .eq("user_id", user.id)
    .single();

  if (profile) {
    await db
      .from("DriverProfile")
      .update({ total_trips: (profile.total_trips ?? 0) + 1 })
      .eq("user_id", user.id);
  }

  return Response.json({ data: { completed: true }, error: null });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "complete/route"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/requests/[id]/complete/route.ts"
git commit -m "feat(location): delete DriverLocation row when trip completes"
```

---

## Task 5: LiveMap component

**Files:**
- Create: `src/components/shared/LiveMap.tsx`

- [ ] **Step 1: Check the components/shared directory exists**

```bash
ls src/components/shared/
```

Expected: you see existing files like `BottomNav.tsx`, `LoadingSkeleton.tsx`. The directory exists.

- [ ] **Step 2: Create LiveMap.tsx**

Create `src/components/shared/LiveMap.tsx`:

```typescript
"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface DriverLocationRow {
  lat:     number;
  lng:     number;
  heading: number | null;
}

export default function LiveMap({ requestId, token }: { requestId: string; token: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markerRef    = useRef<mapboxgl.Marker | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  // Initialise map once on mount
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     "mapbox://styles/mapbox/streets-v12",
      center:    [78.9629, 20.5937],
      zoom:      5,
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current  = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch initial position
  useEffect(() => {
    if (!token || !mapboxToken) return;
    fetch(`/api/location/${requestId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j: { data: DriverLocationRow | null }) => {
        if (j.data && mapRef.current) {
          placeOrMoveMarker(mapRef.current, markerRef, j.data.lat, j.data.lng, j.data.heading);
        }
      })
      .catch(() => {});
  }, [requestId, token, mapboxToken]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!mapboxToken) return;

    const channel = supabase
      .channel(`location:${requestId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "DriverLocation",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as DriverLocationRow;
          if (mapRef.current) {
            placeOrMoveMarker(mapRef.current, markerRef, row.lat, row.lng, row.heading);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, mapboxToken]);

  if (!mapboxToken) {
    return (
      <div className="h-[220px] rounded-2xl bg-pale flex items-center justify-center mt-3">
        <p className="text-xs text-sub">Map unavailable</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[220px] rounded-2xl overflow-hidden mt-3" />;
}

function placeOrMoveMarker(
  map:       mapboxgl.Map,
  markerRef: React.MutableRefObject<mapboxgl.Marker | null>,
  lat:       number,
  lng:       number,
  heading:   number | null,
) {
  if (markerRef.current) {
    markerRef.current.setLngLat([lng, lat]);
    if (heading !== null) {
      markerRef.current.getElement().style.transform = `rotate(${heading}deg)`;
    }
    return;
  }

  // First placement — create the custom marker element
  const el = document.createElement("div");
  el.style.cssText = [
    "width:36px",
    "height:36px",
    "background:#2d6a4f",
    "border-radius:50%",
    "border:3px solid white",
    "box-shadow:0 2px 8px rgba(0,0,0,0.3)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");
  el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
  </svg>`;

  if (heading !== null) el.style.transform = `rotate(${heading}deg)`;

  markerRef.current = new mapboxgl.Marker({ element: el })
    .setLngLat([lng, lat])
    .addTo(map);

  map.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 });
}
```

- [ ] **Step 3: Type-check the new component**

```bash
npx tsc --noEmit 2>&1 | grep "LiveMap"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/LiveMap.tsx
git commit -m "feat(location): add LiveMap Mapbox component with Realtime subscription"
```

---

## Task 6: Driver GPS ping loop

**Files:**
- Modify: `src/app/(fleet)/fleet/today/page.tsx`

The file currently has two `useEffect` hooks: one for initial load, one for polling dispatches every 15s. Add a third for the GPS loop. Also add a "Sharing location" chip inside the IN_PROGRESS branch of `DispatchCard`.

- [ ] **Step 1: Add GPS loop useEffect to TodayPage**

In `TodayPage` (the default export function), add this `useEffect` after the existing polling `useEffect` (the one with `setInterval(() => fetchDispatches(token), 15000)`), before the `const pendingDispatches` lines:

```typescript
  // GPS ping loop — active only while a trip is IN_PROGRESS
  useEffect(() => {
    const inProgress = dispatches.find(
      (d) => d.status === "ACCEPTED" && d.request?.status === "IN_PROGRESS"
    );
    if (!inProgress || !token) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch("/api/location/ping", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({
              request_id: inProgress.request_id,
              lat:        pos.coords.latitude,
              lng:        pos.coords.longitude,
              heading:    pos.coords.heading ?? undefined,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000 },
      );
    }, 10_000);

    return () => clearInterval(interval);
  }, [dispatches, token]);
```

- [ ] **Step 2: Add "Sharing location" chip to IN_PROGRESS DispatchCard**

In `DispatchCard`, inside the `if (req?.status === "IN_PROGRESS")` branch, add the chip before the `completeTrip` button. The current code in that branch ends with a `<button onClick={completeTrip} ...>`. Add immediately before it:

```tsx
        <p className="text-xs text-lime/60 flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse inline-block" />
          Sharing location
        </p>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "today/page"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(fleet)/fleet/today/page.tsx"
git commit -m "feat(location): add GPS ping loop and sharing-location indicator to driver UI"
```

---

## Task 7: Rider map integration

**Files:**
- Modify: `src/app/bookings/page.tsx`

Three changes: (1) dynamic import of `LiveMap`, (2) pass `token` prop to `ConfirmedHeroCard`, (3) render `<LiveMap>` inside `ConfirmedHeroCard`.

- [ ] **Step 1: Add dynamic import at the top of bookings/page.tsx**

After the existing imports (after line 10, the `import { CardSkeleton }` line), add:

```typescript
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@/components/shared/LiveMap"), { ssr: false });
```

- [ ] **Step 2: Update ConfirmedHeroCard signature to accept token**

Change the function signature from:

```typescript
function ConfirmedHeroCard({ req }: { req: MyRequest }) {
```

to:

```typescript
function ConfirmedHeroCard({ req, token }: { req: MyRequest; token: string }) {
```

- [ ] **Step 3: Add LiveMap inside ConfirmedHeroCard**

Add `<LiveMap requestId={req.id} token={token} />` at the very end of the card, just before the closing `</div>` of `ConfirmedHeroCard` (after the `PayNowButton` block). The current last content is:

```tsx
      {req.razorpay_order_id && req.payment_status !== "SUCCESS" && (
        <PayNowButton
          requestId={req.id}
          orderId={req.razorpay_order_id}
          amountPaise={req.fare_paise}
        />
      )}
    </div>
```

Change it to:

```tsx
      {req.razorpay_order_id && req.payment_status !== "SUCCESS" && (
        <PayNowButton
          requestId={req.id}
          orderId={req.razorpay_order_id}
          amountPaise={req.fare_paise}
        />
      )}

      <LiveMap requestId={req.id} token={token} />
    </div>
```

- [ ] **Step 4: Pass token to ConfirmedHeroCard at the call site**

In `MyBookingsPage`, find the confirmed section (currently around line 425–427):

```tsx
            {confirmed.map((req) => (
              <ConfirmedHeroCard key={req.id} req={req} />
            ))}
```

Change to:

```tsx
            {confirmed.map((req) => (
              <ConfirmedHeroCard key={req.id} req={req} token={token} />
            ))}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "bookings/page"
```

Expected: no output.

- [ ] **Step 6: Full type-check to catch any regressions**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: same pre-existing errors as before (`.next/types/validator.ts` and `admin/documents/route.ts`). No new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/bookings/page.tsx
git commit -m "feat(location): render live driver map in rider ConfirmedHeroCard"
```

---

## Task 8: Environment variable and final verification

- [ ] **Step 1: Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local**

Open `.env.local` (or create it if it doesn't exist). Add:

```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiWU9VUl9VU0VSTkFNRSIsImEiOiJZT1VSX1RPS0VOIn0.XXXX
```

Replace the value with your actual Mapbox public token from mapbox.com → Account → Access tokens. Public tokens start with `pk.`.

This env var must also be added in Vercel Dashboard → Project → Settings → Environment Variables (all environments).

- [ ] **Step 2: Run the dev server and verify the map renders**

```bash
npm run dev
```

1. Log in as a rider who has a CONFIRMED or IN_PROGRESS request.
2. Navigate to `/bookings`.
3. The `ConfirmedHeroCard` should show a 220px Mapbox map below the driver info / OTP block.
4. If no driver has pinged yet, the map shows India at zoom 5 with no marker.

- [ ] **Step 3: Verify the driver ping loop starts**

1. Log in as the driver in a second browser tab or incognito.
2. On `/fleet/today`, accept a ride and enter the OTP to start the trip.
3. Open DevTools → Network. Filter by `/api/location/ping`.
4. After 10 seconds, you should see a POST request to `/api/location/ping` with `lat`/`lng` in the body.
5. The response should be `{"ok":true}`.
6. On the rider tab, the map should move the green pin to the driver's coordinates.

- [ ] **Step 4: Verify cleanup on complete**

1. With an active IN_PROGRESS trip, click "Complete Trip" on the driver view.
2. The rider's map should lose the pin (map reverts to India overview or shows placeholder).
3. In Supabase dashboard → Table Editor → DriverLocation: confirm the row for that `request_id` is gone.

- [ ] **Step 5: Final commit**

```bash
git add .env.local
git commit -m "feat(location): Phase 5 location layer complete"
```

> Note: if `.env.local` is in `.gitignore` (it should be), this commit will have no file changes — that is correct. The env var reminder is the point of this step.

---

## Self-review

**Spec coverage:**
- ✅ DriverLocation table + RLS + Realtime publication (Task 1)
- ✅ `POST /api/location/ping` with dispatch + IN_PROGRESS validation (Task 2)
- ✅ `GET /api/location/:requestId` rider auth (Task 3)
- ✅ Delete DriverLocation on complete (Task 4)
- ✅ LiveMap component: map init, initial fetch, Realtime subscription, marker, placeholder (Task 5)
- ✅ Driver GPS ping loop every 10s with silent error handling (Task 6)
- ✅ "Sharing location" chip in IN_PROGRESS DispatchCard (Task 6)
- ✅ `next/dynamic` + `ssr: false` for LiveMap (Task 7)
- ✅ `NEXT_PUBLIC_MAPBOX_TOKEN` env var (Task 8)
- ✅ `transpilePackages: ['mapbox-gl']` in next.config (Task 1)
- ✅ `||` used for env var fallback (not `??`) per Turbopack behaviour

**Type consistency:** `DriverLocationRow` interface defined in Task 5 and used consistently. `placeOrMoveMarker` function signature stable across all usages.
