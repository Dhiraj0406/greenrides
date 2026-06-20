# Driver–Owner Unified Portal Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the driver and owner portals into a single app with a segmented pill toggle, and add an admin-gated owner upgrade request flow for drivers who own 2+ vehicles.

**Architecture:** Both portals already share the same Next.js app at `/fleet/*`. The three subdomains (`driver.`, `owner.`, `fleet.greenrides.co.in`) all route there via `proxy.ts`. No routing or subdomain changes are needed — only UI improvements and new request/approval flows.

**Tech Stack:** Next.js 16 (App Router), Supabase (auth + DB), TypeScript, Tailwind CSS, Sonner toasts, Lucide icons, Prisma ORM.

---

## 1. Architecture

The combined fleet portal already exists. Changes are additive only:

- Replace the current "Switch to Owner/Driver" text button in `fleet/layout.tsx` header with a **segmented pill** positioned below the header bar
- The pill is only rendered when the user has both `driver` and `owner` roles in `app_metadata.roles`
- Owner-only users (no `driver` role): no pill, land directly on owner dashboard
- Driver-only users: no pill, stay on driver nav until admin grants owner access
- After approval, the pill appears automatically on next session load — no page push needed

---

## 2. Data Model

### New table: `OwnerRequest`

```sql
CREATE TABLE "OwnerRequest" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_count  INT NOT NULL CHECK (vehicle_count >= 2),
  reason         TEXT NOT NULL CHECK (char_length(reason) <= 200),
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','DECLINED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX owner_request_user_pending ON "OwnerRequest"(user_id) WHERE status = 'PENDING';
```

The unique partial index ensures one pending request per user at a time. Approved/declined requests are kept for audit.

### Prisma model addition

```prisma
model OwnerRequest {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id       String   @db.Uuid
  vehicle_count Int
  reason        String
  status        String   @default("PENDING")
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  reviewed_at   DateTime? @db.Timestamptz(6)
}
```

No other schema changes. The existing `Owner` table and `app_metadata.roles` array remain unchanged.

---

## 3. UI — Driver-side

### 3.1 Segmented pill (layout.tsx)

Replace the existing `<button>Switch to {mode}</button>` in the header with a pill **below** the header, outside the dark `<header>` block:

```
┌─────────────────────────────┐
│  Green Rides Fleet  [header]│  ← dark forest background
│  Driver Portal              │
└─────────────────────────────┘
  ┌──────────┬──────────┐
  │ 🚗 Driver │ 🏢 Owner │   ← pill, white bg, rounded-full
  └──────────┴──────────┘
     (active)  (inactive)
```

- Active segment: `bg-forest text-white`
- Inactive segment: `text-sub`
- Pill only renders when `canToggle` is true (both roles)
- Tapping switches `mode` state and bottom nav items, exactly as current

### 3.2 Profile page — owner upgrade card

Add at the bottom of `fleet/profile/page.tsx`, below all existing profile fields. Show one of three states based on request status fetched from `GET /api/fleet/owner-request`:

**State A — No request yet:**
```
┌─ Own a fleet? ──────────────────┐
│ Own 2+ vehicles? Apply to       │
│ manage them here.               │
│ [Apply for Owner Access →]      │
└─────────────────────────────────┘
```
Green border (`border-leaf`), `bg-pale` background.

**State B — Pending:**
```
┌─ ● Owner request pending ───────┐
│ Your application is under       │
│ review. We'll notify you once   │
│ approved.                       │
└─────────────────────────────────┘
```
Amber border (`border-amber-400`), `bg-amber-50` background.

**State C — Declined (show after 0 days, reapply allowed immediately):**
```
┌─ ✗ Request not approved ────────┐
│ Admin note (if any). You can    │
│ reapply with updated details.   │
│ [Reapply →]                     │
└─────────────────────────────────┘
```
Red border, `bg-red-50`. Tapping Reapply opens the request form again.

**State D — Already owner:** card is hidden entirely.

### 3.3 Owner request page (`fleet/owner-request/page.tsx`)

New page at `/fleet/owner-request`. Accessible via the Apply button in the profile card.

Fields:
- **Vehicle count picker:** tap-to-select chips for `2`, `3`, `4`, `5+` (maps to 5 = 5 in DB). Required. Must be ≥ 2.
- **Reason textarea:** placeholder "Tell us about your vehicles and routes", max 200 chars, shows char count. Required, min 10 chars.
- **Submit button:** disabled until both fields valid. Shows spinner on submit.
- On success: navigate back to `/fleet/profile` with a toast "Request submitted — we'll review within 24 hours".

---

## 4. API — Fleet-side

### `GET /api/fleet/owner-request`
Returns the user's latest `OwnerRequest` row (any status). Returns `{ data: null }` if none exists. Auth: Bearer token.

### `POST /api/fleet/owner-request`
Body: `{ vehicle_count: number, reason: string }`
Validation: `vehicle_count >= 2`, `reason.length >= 10 && <= 200`.
Upserts: if a DECLINED request exists, creates a new PENDING row. If PENDING exists, returns 409 "Request already pending". If APPROVED, returns 409 "Already an owner".
Auth: Bearer token.

---

## 5. Admin — Approvals page

### UI change: `admin/approvals/page.tsx`

Add a second tab "Owner Requests" alongside the existing "New Drivers" tab. Badge count shows pending requests.

Each owner request card shows:
- Driver avatar (initial), name, phone
- Driver tenure: `X months active` (derived from `Driver.created_at`)
- Declared vehicle count
- Reason (quoted, truncated at 120 chars)
- **Grant Owner Access** button (green, full-width-ish)
- **Decline** button (grey X, compact)

### `GET /api/admin/owner-requests`
Returns all PENDING `OwnerRequest` rows joined with user name/phone (via `auth.users`). Auth: `x-admin-token` header.

### `PATCH /api/admin/owner-requests/[id]`
Body: `{ action: "approve" | "decline" }`

**On approve:**
1. Update `OwnerRequest.status = "APPROVED"`, set `reviewed_at = now()`
2. Create `Owner` row: `{ user_id, status: "ACTIVE" }` (using `upsert` to be safe)
3. Call Supabase Admin API: `supabase.auth.admin.updateUserById(userId, { app_metadata: { roles: [...existingRoles, "owner"] } })`

**On decline:**
1. Update `OwnerRequest.status = "DECLINED"`, set `reviewed_at = now()`
2. No role changes

Auth: `x-admin-token` header.

---

## 6. Error & Edge Cases

| Scenario | Handling |
|---|---|
| Driver already has `owner` role (legacy) | Profile card hidden; pill shown if also has `driver` role |
| User submits while request is PENDING | API returns 409; frontend shows "Already pending" toast |
| Admin approves then immediately declines another | Idempotent upsert on `Owner` table prevents duplicate rows |
| Session token expired on profile load | `getSession().catch` redirects to `/fleet/login` (already fixed) |
| Driver has no pending/approved request and accesses `/fleet/owner-request` directly | Page loads normally — they can submit |

---

## 7. Files Changed / Created

| Action | File |
|---|---|
| Modify | `src/app/(fleet)/fleet/layout.tsx` — replace toggle button with segmented pill |
| Modify | `src/app/(fleet)/fleet/profile/page.tsx` — add owner upgrade card with 4 states |
| Create | `src/app/(fleet)/fleet/owner-request/page.tsx` — request form |
| Create | `src/app/api/fleet/owner-request/route.ts` — GET + POST |
| Create | `src/app/api/admin/owner-requests/route.ts` — GET |
| Create | `src/app/api/admin/owner-requests/[id]/route.ts` — PATCH |
| Modify | `src/app/(admin)/admin/approvals/page.tsx` — add Owner Requests tab |
| Modify | `prisma/schema.prisma` — add OwnerRequest model |
| Migrate | Supabase: add `OwnerRequest` table via SQL migration |
