# Location Layer — Phase 5 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Driver GPS pings + live Mapbox map for riders during CONFIRMED and IN_PROGRESS trips.

**Architecture:** Single upserted `DriverLocation` row per active trip; driver app posts lat/lng every 10s via a REST endpoint; Supabase Realtime broadcasts row UPDATEs to the rider's browser; Mapbox GL JS renders a moving driver pin.

**Tech Stack:** Next.js 16 App Router, Supabase (Realtime + service-role client), Mapbox GL JS (`mapbox-gl`), existing Bearer-token auth pattern.

---

## 1. Data Layer

### Table: `DriverLocation`

```sql
CREATE TABLE IF NOT EXISTS "DriverLocation" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT        UNIQUE NOT NULL,
  driver_id   TEXT        NOT NULL,
  lat         FLOAT8      NOT NULL,
  lng         FLOAT8      NOT NULL,
  heading     FLOAT4,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Keyed on `request_id` (UNIQUE) — one row per active trip, not per driver.
- `heading`: compass bearing (0–360), nullable. Used to rotate the map pin.
- No FK constraints to avoid cross-schema complexity with the Supabase auth schema.

### RLS Policies

```sql
ALTER TABLE "DriverLocation" ENABLE ROW LEVEL SECURITY;

-- Driver can write their own row (INSERT + UPDATE)
CREATE POLICY "location_driver_write" ON "DriverLocation"
  FOR ALL
  USING   (driver_id = auth.uid()::text)
  WITH CHECK (driver_id = auth.uid()::text);

-- Rider can read the location for their own request
CREATE POLICY "location_rider_read" ON "DriverLocation"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "RideRequest"
      WHERE id = request_id
        AND rider_id = auth.uid()::text
    )
  );
```

### Lifecycle

- Row is created on first ping after driver starts the trip (upsert).
- Row is deleted by the server (service-role) inside `POST /api/requests/:id/complete` — no cron needed.

### Migration file

`supabase/migrations/009_driver_location.sql`

No Prisma model — this table is accessed exclusively through the Supabase JS client (required for Realtime).

---

## 2. API Layer

### `POST /api/location/ping`

**Auth:** Bearer token (driver).

**Body:**
```json
{ "request_id": "<uuid>", "lat": 12.9716, "lng": 77.5946, "heading": 270 }
```

**Validation (zod):**
- `request_id`: `z.string().uuid()`
- `lat`: `z.number().min(-90).max(90)`
- `lng`: `z.number().min(-180).max(180)`
- `heading`: `z.number().min(0).max(360).optional()`

**Logic:**
1. Verify driver has an `ACCEPTED` dispatch for `request_id` and the linked `RideRequest.status === "IN_PROGRESS"`.
2. Upsert into `DriverLocation` on `request_id`.
3. Return `{ ok: true }`.

Fire-and-forget from client — errors are logged server-side, not surfaced to the driver UI.

---

### `GET /api/location/[requestId]`

**Auth:** Bearer token (rider).

**Logic:**
1. Verify `RideRequest.rider_id === user.id` for the given `requestId`.
2. Return current `DriverLocation` row or `{ data: null }`.

Used by the rider's map on initial mount before the Realtime channel connects.

---

### Modify `POST /api/requests/[id]/complete`

Add after the existing status update:

```typescript
await db.from("DriverLocation").delete().eq("request_id", requestId);
```

Keeps the table clean. One extra DELETE per completed trip.

---

## 3. Driver App Changes

**File:** `src/app/(fleet)/fleet/today/page.tsx`

### GPS Ping Loop

New `useEffect` — starts when an `IN_PROGRESS` dispatch is detected, clears when the trip ends or the component unmounts:

```typescript
useEffect(() => {
  const inProgressDispatch = acceptedDispatches.find(
    (d) => d.request?.status === "IN_PROGRESS"
  );
  if (!inProgressDispatch || !token) return;

  const interval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch("/api/location/ping", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({
            request_id: inProgressDispatch.request_id,
            lat:        pos.coords.latitude,
            lng:        pos.coords.longitude,
            heading:    pos.coords.heading ?? undefined,
          }),
        }).catch(() => {});  // silent — driver is driving
      },
      () => {}  // silent on geolocation error
    );
  }, 10_000);

  return () => clearInterval(interval);
}, [acceptedDispatches, token]);
```

### UI Addition

Inside the IN_PROGRESS `DispatchCard`, add a static location-sharing chip above the "Complete Trip" button:

```tsx
<p className="text-xs text-lime/60 flex items-center gap-1.5 mb-3">
  <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse inline-block" />
  Sharing location
</p>
```

No interactive elements. No map on the driver side.

---

## 4. Rider App Changes

**File:** `src/app/bookings/page.tsx`

### Map Component

`LiveMap` is defined in `src/components/shared/LiveMap.tsx` and imported at the call site with `next/dynamic` + `ssr: false` to prevent `mapbox-gl`'s `window` access from crashing server prerender:

```typescript
// In bookings/page.tsx
import dynamic from "next/dynamic";
const LiveMap = dynamic(() => import("@/components/shared/LiveMap"), { ssr: false });
```

`src/components/shared/LiveMap.tsx` is a `"use client"` component:

```typescript
// LiveMap({ requestId, token }: { requestId: string; token: string })
```

**Mount sequence:**
1. Import `mapbox-gl` at the top of `LiveMap.tsx` (safe — SSR is disabled for this component).
2. Initialize map with `style: "mapbox://styles/mapbox/streets-v12"`, centered on `[78.9629, 20.5937]` (India) at zoom 5 until first location arrives.
3. `GET /api/location/${requestId}` — fetch initial position. If present, center map at zoom 13 and place driver marker.
4. Subscribe to Supabase Realtime:
   ```typescript
   supabase
     .channel(`location:${requestId}`)
     .on("postgres_changes", {
       event:  "UPDATE",
       schema: "public",
       table:  "DriverLocation",
       filter: `request_id=eq.${requestId}`,
     }, (payload) => {
       const { lat, lng, heading } = payload.new;
       // move marker, rotate by heading
     })
     .subscribe();
   ```
5. Cleanup on unmount: `map.remove()`, unsubscribe channel.

**Driver marker:** Custom SVG element — green circle with a white car icon, 36×36px. Rotated by `heading` via `style.transform = \`rotate(${heading}deg)\``.

**Placeholder (no location yet):**
```tsx
<div className="h-[220px] rounded-2xl bg-pale flex items-center justify-center">
  <p className="text-xs text-sub">Waiting for driver location…</p>
</div>
```

### Integration into `ConfirmedHeroCard`

`LiveMap` renders below the OTP display (CONFIRMED) or below the "Trip in progress" header (IN_PROGRESS), inside the existing card container. Height: 220px, `rounded-2xl`, `overflow-hidden`.

### Environment Variable

`NEXT_PUBLIC_MAPBOX_TOKEN` — public Mapbox access token. Must be set in Vercel env and `.env.local`. The token is safe to expose client-side (Mapbox tokens are public-facing by design; restrict by URL in the Mapbox dashboard).

---

## 5. New Package

`mapbox-gl` — added to `dependencies`. No `react-map-gl` wrapper.

Also requires `@types/mapbox-gl` in `devDependencies`.

CSS must be imported once in a layout or the component:
```typescript
import "mapbox-gl/dist/mapbox-gl.css";
```

---

## 6. Error Handling

| Scenario | Handling |
|---|---|
| Driver denies geolocation permission | Silent — no ping sent, no UI change. Rider sees "Waiting for driver location…" |
| Ping POST fails (network) | Silent catch — driver is driving, no distraction |
| Realtime channel disconnects | Mapbox marker freezes at last known position; channel auto-reconnects via Supabase client |
| `NEXT_PUBLIC_MAPBOX_TOKEN` missing | `LiveMap` renders the placeholder div (token undefined → map init skipped) |
| Rider views trip after completion | `DriverLocation` row already deleted; `GET /api/location/:id` returns null; no map rendered (status is COMPLETED) |

---

## 7. Testing

- **API:** POST `/api/location/ping` with valid IN_PROGRESS dispatch → 200, row upserted. POST without valid dispatch → 403.
- **Cleanup:** POST `/api/requests/:id/complete` → DriverLocation row deleted.
- **Driver UI:** IN_PROGRESS card shows "Sharing location" chip.
- **Rider UI:** CONFIRMED/IN_PROGRESS request shows map container; PENDING/COMPLETED do not.
- **No regression:** Existing accept/reject/start/complete flows unchanged.
