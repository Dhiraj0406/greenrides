# Autocomplete + Live Ride Status Design

**Date:** 2026-05-06  
**Project:** Green — Odisha Hill Routes ride platform

## Overview

Two features shipped together:
1. Destination autocomplete dropdown (1-char trigger, floating panel)
2. Live confirmed ride status card on /bookings + admin driver-info entry

---

## Feature 1: Destination Autocomplete Dropdown

**File:** `src/components/booking/DestinationGrid.tsx`

### Behaviour
- Search box already exists; currently filters inline at 2+ chars
- Change: trigger at **1 char**, render floating dropdown panel below input instead of filtering the grid
- Dropdown: absolute positioned, z-50, white card with shadow, rounded-xl
- Each row: city name (bold) + fare (₹, right-aligned) + distance (mono, sub color)
- Max 6 rows visible; scrollable beyond that
- Selecting a row calls existing `selectRoute()`, closes dropdown, clears query
- Keyboard: ArrowUp/Down highlights rows, Enter selects, Escape closes
- Click outside (mousedown on document): closes dropdown
- Existing grid of featured route cards remains visible beneath the dropdown

### Data source
No new API. Uses `allRoutes` array already cached in `routeCacheRef`. Filter: `to_city.toLowerCase().includes(trimmed)` starting at 1 char.

---

## Feature 2: Driver Info on Confirmed Requests

### 2a. Schema change — `prisma/schema.prisma`
Add to `RideRequest` model:
```
driver_name  String?
driver_phone String?
eta_min      Int?
```
Run `npx prisma db push` (nullable additions, no data loss).

### 2b. API: `GET /api/requests`
Add `driver_name`, `driver_phone`, `eta_min` to the `select` block.

### 2c. API: `PATCH /api/admin/requests/[id]`
Extend Zod schema to accept optional `driver_name`, `driver_phone`, `eta_min` fields.  
When `status === "CONFIRMED"` and those fields are present, write them alongside the status update.  
Ignored for COMPLETED/CANCELLED updates.

### 2d. Admin bookings page — `src/app/(admin)/admin/bookings/page.tsx`
Replace the direct "Confirm →" button with a two-step flow:
- Tap "Confirm →": expands an inline form below that card
- Form fields: Driver name (text), Driver phone (tel), ETA in minutes (number)
- "Confirm Booking" button: submits PATCH with status + driver fields
- "Cancel" link: collapses form, no change saved
- State: `confirmingId: string | null` — which card has form open

### 2e. /bookings page — `src/app/bookings/page.tsx`
- Poll `/api/requests` every 15 seconds via `setInterval` (cleared on unmount)
- If any request has `status === "CONFIRMED"`: render as hero card at top
- Hero card: forest-green background, "Your ride is confirmed!" heading, route, travel date, driver name + tap-to-call phone, ETA display ("Driver arriving in ~{eta_min} min" or "Call driver for ETA" if null)
- Normal request cards rendered below hero
- Polling stops (interval cleared) when status moves past CONFIRMED

---

## Out of scope
- Push notifications (separate sprint)
- Supabase Realtime (polling is sufficient at MVP scale)
- Recent search history
