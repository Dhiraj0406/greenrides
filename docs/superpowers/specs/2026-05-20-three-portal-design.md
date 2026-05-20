# Green Rides — Three-Portal Redesign

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Rider portal, Admin portal, Fleet portal (owners + drivers)

---

## 1. Architecture

One Next.js codebase, three subdomains, single Vercel deployment.

```
src/app/
  (rider)/      → green-rides.vercel.app        (riders — existing app)
  (admin)/      → admin.green-rides.vercel.app   (admin team)
  (fleet)/      → fleet.green-rides.vercel.app   (owners + drivers)
```

`proxy.ts` reads the incoming `host` header and rewrites to the correct route group. Auth enforcement also lives there.

```ts
const host = req.headers.get("host") ?? "";
const isAdmin = host.startsWith("admin.");
const isFleet = host.startsWith("fleet.");
```

Pattern matches by prefix so custom domain migration (GoDaddy → Vercel aliases) requires zero code changes.

**Role system — Supabase `app_metadata` (server-side, tamper-proof):**

| roles value | Access |
|---|---|
| `["rider"]` | Rider portal only (default on signup) |
| `["driver"]` | Fleet portal, driver mode |
| `["owner"]` | Fleet portal, owner mode |
| `["owner", "driver"]` | Fleet portal, both modes with toggle |
| `["admin"]` | Admin portal |

Role assignment happens server-side via Supabase Admin SDK when admin approves an application.

---

## 2. Data Model

### New tables

**`Owner`**
```
id           String   PK uuid
user_id      String   unique (Supabase auth UID)
name         String
phone        String
email        String?
status       Enum     PENDING | ACTIVE | SUSPENDED
created_at   DateTime
```

**`Vehicle`**
```
id           String   PK uuid
owner_id     String   FK → Owner
make         String
model_name   String
number       String   unique (plate number)
seats        Int      default 4
active       Boolean  default true
driver_id    String?  FK → Driver (currently assigned driver, nullable)
created_at   DateTime
```

**`Notification`**
```
id           String   PK uuid
user_id      String   (Supabase auth UID)
type         String   booking_assigned | booking_cancelled | dispatch_new | payout_ready
title        String
body         String
read         Boolean  default false
created_at   DateTime
index on (user_id, read)
```

**`OwnerPayout`**
```
id           String   PK uuid
owner_id     String   FK → Owner
amount_paise Int
period_from  DateTime
period_to    DateTime
status       Enum     PENDING | PAID
paid_at      DateTime?
created_at   DateTime
```

### Modified tables

**`Driver`** — add two fields:
- `owner_id String?` FK → Owner (null = independent solo driver)
- `status Enum` PENDING | ACTIVE | SUSPENDED

### Relationships

```
Owner ──< Vehicle >── Driver  (vehicle has one assigned driver)
Owner ──< Driver              (fleet drivers working under owner)
Driver exists without owner   (independent solo driver)
Owner can have own Driver record (solo owner-driver, roles = ["owner","driver"])
```

---

## 3. Portal Designs

### 3.1 Rider Portal — `green-rides.app`

Existing app, no structural changes. The hybrid ride discovery flow stays:

| Page | Notes |
|---|---|
| `/` | Route search → DriverSheet (marketplace) or RequestSheet (custom request) |
| `/bookings` | History, cancel, rate |
| `/confirm` | Post-payment confirmation |
| `/profile` | Name, phone, email |

### 3.2 Admin Portal — `admin.green-rides.app`

Extends the existing `/admin` section into a standalone portal.

| Page | Purpose |
|---|---|
| Dashboard | Revenue, bookings, active drivers, pending approvals count |
| Approvals | Driver + owner applications, view submitted details, Approve / Reject |
| Drivers | All drivers, status badge, suspend/activate |
| Owners | All owners, fleet size per owner, suspend/activate |
| Payouts | OwnerPayout list by period, mark as PAID after bank transfer |
| Fares | Existing FareTable component |
| Discounts | Existing GlobalDiscount component |
| Requests | RideRequest list + manual dispatch to drivers |

On approve: backend calls Supabase Admin SDK to set `app_metadata.roles`, Driver/Owner record status → ACTIVE.

### 3.3 Fleet Portal — `fleet.green-rides.app`

Single portal, two modes. Toggle shown only if user has both `owner` and `driver` roles.

**Owner mode:**

| Page | Purpose |
|---|---|
| Dashboard | Today's bookings across fleet, this month's earnings |
| My Fleet | Vehicle cards: make/model/plate, assigned driver, edit, deactivate |
| Add Vehicle | Form: make, model, plate, seats → active immediately |
| Drivers | Fleet drivers list, assign/unassign to vehicles |
| Earnings | Per-vehicle booking breakdown, pending OwnerPayout from platform |
| Notifications | In-app bell feed |

**Driver mode:**

| Page | Purpose |
|---|---|
| Today | Rides assigned for today with pickup details |
| History | Past rides: date, route, amount |
| Availability | Online / Offline toggle (affects marketplace visibility) |
| Profile | Name, phone, vehicle info |
| Notifications | In-app bell feed + Telegram link |

---

## 4. Key Flows

### 4.1 Onboarding

```
Applicant visits fleet.green-rides.app
  → "Register" → phone OTP (Supabase)
  → Form: name, Aadhaar, DL, vehicle details
    (tick "I also drive" if owner+driver)
  → status: PENDING → sees "Application under review" screen

Admin sees badge on Approvals page
  → Reviews → Approve / Reject
  → On Approve:
      app_metadata.roles set via Supabase Admin SDK
      Driver/Owner.status → ACTIVE
  → Applicant gets Telegram notification → portal access unlocked
```

### 4.2 Booking — Path A (Marketplace)

```
Rider enters route → DriverSheet
  → sees available rides for today (existing /api/rides)
  → selects ride → payment (cash or Razorpay when live)
  → Booking created
  → Driver: in-app notification + Telegram alert
  → Rider: in-app notification
```

### 4.3 Booking — Path B (Custom Request)

```
Rider opens RequestSheet → submits from/to/date/time/fare
  → RideRequest created (status: PENDING)
  → Admin dispatches to driver from admin portal
  → Driver: sees new dispatch + Telegram alert
  → Driver accepts → Booking created → both notified
  → Driver rejects → admin re-dispatches
```

### 4.4 Earnings & Payouts

```
Online payment:
  Rider pays platform → Booking.amount_paise captured
  Admin aggregates weekly: bookings per owner → OwnerPayout created
  Admin makes bank transfer → marks OwnerPayout as PAID
  Owner sees history on Earnings page
  Owner pays their drivers (outside platform)

Cash payment (MVP):
  Rider pays driver directly
  Recorded as cash booking
  No platform cut, no payout tracking (add later)
```

---

## 5. Error Handling & Edge Cases

**Auth guards:**
- Rider visits `fleet.*` → redirect to rider portal, toast: "You don't have fleet access"
- PENDING applicant logs in → "Application under review" page, no portal content
- SUSPENDED account → "Account suspended, contact support" page

**Fleet edge cases:**
- Owner deactivates vehicle with active booking → vehicle marked inactive, existing booking completes, no new bookings
- Owner removes driver with rides today → driver sees rides, admin alerted to re-dispatch
- Solo driver tries owner route → toggle not rendered, server guard returns 403

**Booking edge cases:**
- All drivers reject a dispatch → RideRequest stays PENDING, rider notified "Finding you a driver"
- Rider cancels after acceptance → Booking cancelled, driver notified, no payout generated
- Cash booking → excluded from OwnerPayout calculations

**Data integrity:**
- Vehicle plate number: unique constraint at DB level
- Driver can be assigned to one vehicle at a time: enforced at API level

---

## 6. Notifications

| Trigger | Channel | Recipient |
|---|---|---|
| Booking created | In-app + Telegram | Driver |
| Booking created | In-app | Rider |
| Dispatch assigned | In-app + Telegram | Driver |
| Booking cancelled | In-app + Telegram | Driver |
| Application approved | Telegram | Driver/Owner |
| Payout marked PAID | In-app | Owner |

WhatsApp (Interakt) added later as volume grows.

---

## 7. Out of Scope (this spec)

- Razorpay payment integration (under merchant verification, revisit 2026-05-24)
- Driver earnings split tracking within platform (owner pays drivers externally)
- Mobile apps
- Custom domain setup (GoDaddy → Vercel aliases, no code changes required)
- Driver document upload/storage (Aadhaar, DL images)
- Rating system for owners/fleet vehicles
