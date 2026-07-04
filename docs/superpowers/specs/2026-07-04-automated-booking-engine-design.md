# Automated Booking Engine — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove admin from the happy-path booking flow. When a driver accepts a dispatch, the booking auto-confirms instantly with the driver's details. If no driver accepts within 4 hours of booking, the request auto-cancels and admin is alerted. Admin retains a manual override for edge cases.

**Architecture:** Two touch points — (1) extend the existing `respond` API route to auto-confirm on accept, (2) a new hourly cron that cancels stale PENDING requests and alerts admin via Telegram. No DB schema changes required.

**Tech Stack:** Next.js 16 App Router, Supabase (admin client), TypeScript, existing Telegram lib, existing Vercel cron pattern.

---

## 1. Auto-Confirm on Driver Accept

**File:** `src/app/api/requests/[id]/respond/route.ts`

**Current behaviour:** On `action = "accept"`, sets `DriverDispatch.status = ACCEPTED`. `RideRequest` stays `PENDING`.

**New behaviour:** After accepting the dispatch, the route additionally:

1. Fetches the accepting driver's name and phone:
   - `DriverProfile` joined with `User` on `user_id` to get `User.name` (from `user_metadata`) and `User.phone`
2. Updates `RideRequest` in a single query:
   ```
   status       = "CONFIRMED"
   driver_name  = <driver's display name>
   driver_phone = <driver's phone>
   updated_at   = now()
   ```
3. Sets all other `DriverDispatch` rows for this `request_id` where `status IN ("PENDING", "WAITING")` → `SKIPPED`, so cascaded drivers are not notified after the fact.
4. Returns the existing response shape — no client changes needed on the fleet app.

**Driver name resolution:** `User.user_metadata->>'name'` if set, else `User.phone` as fallback. Never null — the driver's phone is always available from Supabase auth.

**Failure safety:** If the RideRequest update fails (e.g. already CONFIRMED by admin override), the respond route returns a 409 with "Already confirmed" — fleet app shows a toast and refreshes.

**No ETA at confirm time.** Green Rides is an advance-booking platform. Riders coordinate timing directly with the driver via phone after confirmation.

---

## 2. 4-Hour Auto-Cancel Cron

**New file:** `src/app/api/cron/auto-cancel/route.ts`

**Schedule:** `0 * * * *` — top of every hour (added to `vercel.json` crons array).

**Auth:** Same pattern as existing crons — accepts `x-vercel-cron: 1` header or `Authorization: Bearer <CRON_SECRET>`.

**Logic:**

1. Compute cutoff: `now - 4 hours` in IST.
2. Query: `RideRequest WHERE status = 'PENDING' AND created_at < cutoff`.
3. For each result:
   - Set `status = 'CANCELLED'`, `updated_at = now()`.
   - Send one Telegram message to the admin chat (`TELEGRAM_ADMIN_CHAT_ID` env var):
     ```
     ❌ No driver found — auto-cancelled
     Route: {from_city} → {to_city}
     Date: {travel_date}
     Rider: {rider_phone}
     Booked: {created_at formatted IST}
     ```
4. Return `{ data: { cancelled: N }, error: null }`.

**Batch safety:** Processes all stale requests in one pass. Uses `Promise.allSettled` for Telegram sends so one failed notification doesn't abort others.

**Rider notification:** The existing 10-second poll on `/bookings` detects the status change to CANCELLED and fires the in-app status-change toast automatically — no additional work needed.

---

## 3. Admin UI — Override Mode

**File:** `src/app/(admin)/admin/bookings/page.tsx`

Two cosmetic changes only — no functional changes to the existing confirm flow:

1. **Button label:** `"Confirm →"` → `"Assign Driver ↗"` for PENDING requests.
2. **Helper text:** Add a single line under each PENDING card body:
   ```
   Waiting for a driver to accept — or assign one manually above.
   ```
   Styled `text-xs text-sub italic`.

The existing confirm modal (driver name, phone, ETA fields) is unchanged. Admin can still use it as a power tool when a driver calls in directly or for VIP bookings.

---

## Data Flow Summary

```
Rider books
    │
    ▼
RideRequest PENDING
DriverDispatch queue built → Telegram to first driver
    │
    ├─── Driver accepts (fleet app)
    │       │
    │       ▼
    │   respond API: auto-confirm
    │   RideRequest → CONFIRMED (driver_name, driver_phone set)
    │   Other dispatches → SKIPPED
    │   Rider sees confirmation within 10s (poll)
    │
    ├─── No driver accepts within 4 hours
    │       │
    │       ▼
    │   auto-cancel cron
    │   RideRequest → CANCELLED
    │   Telegram alert → admin
    │   Rider sees cancellation within 10s (poll)
    │
    └─── Admin manually assigns (override)
            │
            ▼
        Existing confirm flow unchanged
        RideRequest → CONFIRMED
```

---

## What Is NOT Changing

- Driver OTP flow (start trip) — unchanged
- Driver complete trip flow — unchanged
- Admin can still manually confirm any PENDING booking at any time
- Rider cancel (DELETE /api/requests/[id]) — unchanged
- Fare, payment, Razorpay — out of scope for this spec
- WhatsApp notifications — out of scope (on hold)
