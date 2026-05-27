# Driver Flow Design

**Date:** 2026-05-17  
**Status:** Approved  

---

## Overview

A complete end-to-end driver experience built into Green Rides at `/drivers`. Covers public discovery, onboarding, vehicle registration, Telegram linking, calendar availability, and a fairness-based dispatch cascade with accept/reject. All pages live under `/drivers` (plural); existing `/driver/*` routes will redirect there.

---

## Pages & Routes

| Route | Access | Purpose |
|---|---|---|
| `/drivers` | Public | Landing page — hero, benefits, how it works, "Become a Driver" CTA. Logged-in approved drivers redirect to `/drivers/dashboard`. |
| `/drivers/register` | Logged-in, no driver profile | One-time registration: name, vehicle type/model/number, license number, Telegram bot link-up. |
| `/drivers/pending` | Registered, not approved | Waiting screen. Auto-redirects to dashboard once admin approves. |
| `/drivers/dashboard` | Approved drivers only | Tabbed portal: Home / Requests / Schedule / Rides. |

### Dashboard Tabs

- **Home** — Online/offline toggle, today's stats (trips, earnings, rating), active dispatch card when a request is live.
- **Requests** — History of all dispatches — accepted, rejected, expired, with timestamps.
- **Schedule** — Calendar availability UI (see below).
- **Rides** — Completed and upcoming rides, per-ride earnings.

### Auth Flow

Drivers use the existing `/login` phone OTP flow. After login, the app checks:
1. No driver profile → redirect to `/drivers/register`
2. Profile exists, not approved → redirect to `/drivers/pending`
3. Approved → redirect to `/drivers/dashboard`

---

## Database Schema Changes

### Extend `DriverProfile`

```prisma
is_online        Boolean   @default(false)
telegram_chat_id String?
availability     Json?     -- { "2026-05-17": { start: "08:00", end: "18:00" }, "2026-05-18": "rest" }
approved_at      DateTime?
```

### New `DriverDispatch` model

```prisma
model DriverDispatch {
  id            String         @id @default(uuid())
  request_id    String
  driver_id     String
  order_index   Int
  status        DispatchStatus @default(WAITING)
  dispatched_at DateTime?
  expires_at    DateTime?
  responded_at  DateTime?
  created_at    DateTime       @default(now())

  request RideRequest @relation(fields: [request_id], references: [id])
  driver  User        @relation(fields: [driver_id], references: [id])

  @@unique([request_id, order_index])
}

enum DispatchStatus {
  WAITING
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}
```

### Extend `RideRequest`

```prisma
dispatched Boolean @default(false)
```

### New `TelegramCode` model

```prisma
model TelegramCode {
  id         String   @id @default(uuid())
  code       String   @unique
  chat_id    String
  expires_at DateTime
  created_at DateTime @default(now())
}
```

Dispatch cron deletes rows where `expires_at < now()` on each run.

---

## Dispatch Algorithm

### On new ride request (`POST /api/requests`)

1. Query all approved, online drivers with `availability` filled for the request's `travel_date`.
2. Sort by `total_trips ASC`, then `approved_at ASC` as tiebreaker (fairness — fewest trips gets priority).
3. Insert one `DriverDispatch` row per driver with sequential `order_index` (1, 2, 3…).
4. Set `RideRequest.dispatched = true`.
5. Activate dispatch #1: `status = PENDING`, `dispatched_at = now()`, `expires_at = now() + 60s`.
6. Send Telegram message to Driver 1 + fire Supabase Realtime update on the `DriverDispatch` table (driver app subscribes filtered by `driver_id = current user`).

### Cron job (`GET /api/cron/dispatch`, every 60s)

Protected by `CRON_SECRET`. Defined in `vercel.json`.

1. Find all `DriverDispatch` where `status = PENDING AND expires_at < now()`.
2. Set them to `EXPIRED`.
3. For each expired dispatch, find the next `WAITING` entry on the same request (`order_index + 1`).
4. If found → activate it (`PENDING`, `dispatched_at`, `expires_at`), notify via Telegram + Realtime.
5. If no next driver → set `RideRequest.status = CANCELLED`, send Telegram to rider: "No drivers available."

### Driver responds (`PATCH /api/requests/[id]/respond`)

**Accept:**
- Set this `DriverDispatch.status = ACCEPTED`, `responded_at = now()`.
- Set all other `DriverDispatch` for this request to `SKIPPED`.
- Update `RideRequest` with driver name and phone; set status to `CONFIRMED`.
- Driver must supply `eta_min` (integer) in the request body.
- Send Telegram to rider with driver details and ETA.
- `total_trips` is incremented when the driver marks the ride **completed** (not on accept).

**Reject:**
- Set this `DriverDispatch.status = REJECTED`, `responded_at = now()`.
- Immediately activate the next `WAITING` dispatch (don't wait for cron).
- If no next driver → cancel request, notify rider.

---

## Availability — Calendar UI

- Full month calendar view. Driver can page forward to future months.
- **Next 7 days from today are required.** Each of these days shows a red border if unfilled.
- A warning banner at the top counts unfilled required days. Drivers with unfilled required days are excluded from dispatch.
- Tapping a date opens a detail card below the calendar with:
  - Toggle: **Available** / **Rest Day**
  - If Available: start time + end time pickers (hour granularity)
- Days beyond the next 7 are optional — drivers can fill as far ahead as they want.
- Stored as JSON in `DriverProfile.availability`: keys are `YYYY-MM-DD`, values are `{ start, end }` or `"rest"`.

---

## Telegram Integration

**Bot setup:** One-time creation via @BotFather. `TELEGRAM_BOT_TOKEN` added to Vercel production env.

**Driver linking (during registration):**
1. Registration page shows: "Open @GreenRidesBot on Telegram and send `/start`."
2. Bot receives `/start`, generates a 6-digit code, inserts a row into a new `TelegramCode` table (`code`, `chat_id`, `expires_at = now() + 10 min`). The dispatch cron cleans up expired codes on each run.
3. Driver types the 6-digit code into the registration form.
4. Server looks up the code, retrieves `chat_id`, saves to `DriverProfile.telegram_chat_id`.

**New route:** `POST /api/telegram/webhook` — receives Telegram bot updates (the `/start` command).

**Messages:**

| Event | Recipient | Message |
|---|---|---|
| Admin approves driver | Driver | "✅ You're approved on Green Rides! Open the app to go online." |
| New dispatch | Driver | "🚗 New ride: {from} → {to} · ₹{fare} · {n} rider(s). 60 seconds to respond. Open app now." |
| Dispatch expired | Driver | "⏱ Request passed to next driver." |
| Driver accepts | Rider | "✅ Driver found! {name} · {phone} · ETA {eta} mins." |
| No drivers available | Rider | "😔 No drivers available right now. We'll notify you when one is free." |

---

## Admin Changes

### Existing `/admin/drivers` (enhancements)
- Approving a driver automatically triggers Telegram notification.
- Driver card shows `is_online` status (green/grey dot).
- Driver card shows count of availability days filled for the coming week.
- New "Dispatch Log" link on each card → shows accepted/rejected/expired counts.

### New `/admin/drivers/dispatch`
- Read-only table of active `RideRequest` records and their live dispatch state.
- Shows: current driver being notified, seconds remaining, cascade position.
- **Manual override:** admin can skip current driver → immediately activates next.
- **Manual assign:** admin can assign a request directly to any approved driver, bypassing the algorithm.

---

## New API Routes Summary

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/drivers/me` | Get current driver's profile + dispatch state |
| POST | `/api/drivers/register` | Create DriverProfile after login |
| PATCH | `/api/drivers/me` | Update availability JSON, online status |
| GET | `/api/cron/dispatch` | Cron: cascade expired dispatches (CRON_SECRET protected) |
| PATCH | `/api/requests/[id]/respond` | Driver accepts or rejects a dispatch |
| POST | `/api/telegram/webhook` | Receive Telegram bot updates |
| GET | `/api/admin/dispatch` | Admin: list all active dispatches |
| PATCH | `/api/admin/dispatch/[id]/override` | Admin: skip or manually assign |

---

## Vercel Cron Config (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/dispatch",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## New Environment Variables

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token from @BotFather |

---

## What Changes to Existing Code

- `/driver/dashboard` and `/driver/post-ride` → add redirects to `/drivers/dashboard`
- `POST /api/requests` → add dispatch queue creation after saving the request
- `/admin/drivers` page → add online indicator, availability summary, Telegram trigger on approve
- Prisma schema → 3 changes above, run `prisma migrate`
