# Driver–Owner Unified Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner upgrade request flow for drivers, surface it in the admin Approvals page, and replace the header toggle button with a segmented pill below the header.

**Architecture:** The combined `/fleet/*` app already exists and serves all three subdomains. All changes are additive: one new DB table, two new API route files, one new page, and modifications to three existing files. No routing or proxy changes needed.

**Tech Stack:** Next.js 16 App Router, Supabase (auth + DB via `getAdminClient()`), TypeScript, Tailwind CSS, Sonner toasts, Lucide icons. No new npm packages.

---

## File Map

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `src/app/api/fleet/owner-request/route.ts` |
| Create | `src/app/api/admin/owner-requests/route.ts` |
| Create | `src/app/api/admin/owner-requests/[id]/route.ts` |
| Create | `src/app/(fleet)/fleet/owner-request/page.tsx` |
| Modify | `src/app/(fleet)/fleet/profile/page.tsx` |
| Modify | `src/app/(fleet)/fleet/layout.tsx` |
| Modify | `src/app/(admin)/admin/approvals/page.tsx` |

---

## Task 1: Add OwnerRequest to Prisma schema + run SQL migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the OwnerRequest model to Prisma schema**

Open `prisma/schema.prisma` and add this block at the very end of the file (after `CarInquiry`):

```prisma
// ─── OWNER UPGRADE REQUESTS ──────────────────────────
model OwnerRequest {
  id            String    @id @default(uuid())
  user_id       String
  vehicle_count Int
  reason        String
  status        String    @default("PENDING")
  created_at    DateTime  @default(now())
  reviewed_at   DateTime?

  @@index([user_id])
  @@index([status])
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the SQL migration in Supabase**

Open the Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
CREATE TABLE IF NOT EXISTS "OwnerRequest" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_count  INT NOT NULL CHECK (vehicle_count >= 2),
  reason         TEXT NOT NULL CHECK (char_length(reason) <= 200),
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','DECLINED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_request_user_pending
  ON "OwnerRequest"(user_id) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS owner_request_status
  ON "OwnerRequest"(status);
```

Expected: "Success. No rows returned."

- [ ] **Step 4: Verify the table exists**

In Supabase SQL Editor run:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'OwnerRequest' ORDER BY ordinal_position;
```

Expected: 7 rows — id, user_id, vehicle_count, reason, status, created_at, reviewed_at.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add OwnerRequest model to schema"
```

---

## Task 2: Fleet API — GET + POST /api/fleet/owner-request

**Files:**
- Create: `src/app/api/fleet/owner-request/route.ts`

This route lets a driver check their own request status (GET) and submit a new request (POST).

Auth pattern: same as all other fleet routes — extract Bearer token, call `db.auth.getUser(token)` to get the user, then use `user.id` for DB queries.

- [ ] **Step 1: Create the route file**

Create `src/app/api/fleet/owner-request/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

async function getUser(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data } = await db.auth.getUser(token);
  return data.user ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data, error } = await db
    .from("OwnerRequest")
    .select("id, vehicle_count, reason, status, created_at, reviewed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[fleet/owner-request GET]", error);
    return Response.json({ data: null, error: "Failed to fetch request" }, { status: 500 });
  }
  return Response.json({ data, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const roles: string[] = (user.app_metadata?.roles as string[]) ?? [];
  if (roles.includes("owner")) {
    return Response.json({ data: null, error: "Already an owner" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const { vehicle_count, reason } = (body ?? {}) as { vehicle_count?: number; reason?: string };

  if (!vehicle_count || vehicle_count < 2) {
    return Response.json({ data: null, error: "Must declare at least 2 vehicles" }, { status: 400 });
  }
  if (!reason || reason.trim().length < 10) {
    return Response.json({ data: null, error: "Reason must be at least 10 characters" }, { status: 400 });
  }
  if (reason.trim().length > 200) {
    return Response.json({ data: null, error: "Reason must be 200 characters or less" }, { status: 400 });
  }

  const db = getAdminClient();

  // Check for existing PENDING request
  const { data: existing } = await db
    .from("OwnerRequest")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existing) {
    return Response.json({ data: null, error: "Request already pending" }, { status: 409 });
  }

  const { data, error } = await db
    .from("OwnerRequest")
    .insert({ user_id: user.id, vehicle_count, reason: reason.trim() })
    .select()
    .single();

  if (error) {
    console.error("[fleet/owner-request POST]", error);
    return Response.json({ data: null, error: "Failed to submit request" }, { status: 500 });
  }
  return Response.json({ data, error: null }, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test — GET with no session**

```bash
curl -s http://localhost:3000/api/fleet/owner-request | python -m json.tool
```

Expected: `{"data":null,"error":"Unauthorized"}` with status 401.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fleet/owner-request/route.ts
git commit -m "feat: fleet owner-request GET + POST API"
```

---

## Task 3: Admin API — GET list + PATCH approve/decline

**Files:**
- Create: `src/app/api/admin/owner-requests/route.ts`
- Create: `src/app/api/admin/owner-requests/[id]/route.ts`

- [ ] **Step 1: Create the GET route (list pending requests)**

Create `src/app/api/admin/owner-requests/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  try {
    // Fetch pending requests
    const { data: requests, error: reqErr } = await db
      .from("OwnerRequest")
      .select("id, user_id, vehicle_count, reason, created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (reqErr) throw reqErr;
    if (!requests?.length) return Response.json({ data: [], error: null });

    const userIds = requests.map((r) => r.user_id);

    // Fetch user names/phones from User table
    const { data: users } = await db
      .from("User")
      .select("id, name, phone")
      .in("id", userIds);

    // Fetch driver tenure from DriverProfile
    const { data: profiles } = await db
      .from("DriverProfile")
      .select("user_id, created_at")
      .in("user_id", userIds);

    const userMap  = Object.fromEntries((users  ?? []).map((u) => [u.id,      u]));
    const profMap  = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = requests.map((r) => {
      const u    = userMap[r.user_id]  ?? {};
      const prof = profMap[r.user_id]  ?? {};
      const monthsActive = prof.created_at
        ? Math.floor((Date.now() - new Date(prof.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;
      return { ...r, name: u.name ?? null, phone: u.phone ?? null, months_active: monthsActive };
    });

    return Response.json({ data: enriched, error: null });
  } catch (err) {
    console.error("[admin/owner-requests GET]", err);
    return Response.json({ data: null, error: "Failed to fetch requests" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the PATCH route (approve / decline)**

Create `src/app/api/admin/owner-requests/[id]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const { action } = body as { action?: string };

  if (action !== "approve" && action !== "decline") {
    return Response.json({ data: null, error: "action must be approve or decline" }, { status: 400 });
  }

  const db = getAdminClient();

  // Fetch the request
  const { data: ownerReq, error: fetchErr } = await db
    .from("OwnerRequest")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (fetchErr || !ownerReq) {
    return Response.json({ data: null, error: "Request not found" }, { status: 404 });
  }
  if (ownerReq.status !== "PENDING") {
    return Response.json({ data: null, error: "Request is no longer pending" }, { status: 409 });
  }

  const newStatus = action === "approve" ? "APPROVED" : "DECLINED";

  // Update request status
  const { error: updateErr } = await db
    .from("OwnerRequest")
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin/owner-requests PATCH update]", updateErr);
    return Response.json({ data: null, error: "Failed to update request" }, { status: 500 });
  }

  if (action === "approve") {
    // Fetch user details for Owner row
    const { data: userData } = await db
      .from("User")
      .select("id, name, phone, email")
      .eq("id", ownerReq.user_id)
      .single();

    // Create Owner row (upsert in case one already exists)
    await db.from("Owner").upsert({
      user_id: ownerReq.user_id,
      name:    userData?.name  ?? "",
      phone:   userData?.phone ?? "",
      email:   userData?.email ?? null,
      status:  "ACTIVE",
    }, { onConflict: "user_id" });

    // Add owner role to app_metadata
    const { data: { user } } = await db.auth.admin.getUserById(ownerReq.user_id);
    const existingRoles: string[] = (user?.app_metadata?.roles as string[]) ?? [];
    if (!existingRoles.includes("owner")) {
      await db.auth.admin.updateUserById(ownerReq.user_id, {
        app_metadata: { roles: [...existingRoles, "owner"] },
      });
    }
  }

  return Response.json({ data: { status: newStatus }, error: null });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/owner-requests/route.ts "src/app/api/admin/owner-requests/[id]/route.ts"
git commit -m "feat: admin owner-requests GET list + PATCH approve/decline"
```

---

## Task 4: Owner request form page

**Files:**
- Create: `src/app/(fleet)/fleet/owner-request/page.tsx`

This is the form a driver fills in when they tap "Apply for Owner Access" from their Profile page.

- [ ] **Step 1: Create the page**

Create `src/app/(fleet)/fleet/owner-request/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const COUNTS = [
  { label: "2",  value: 2 },
  { label: "3",  value: 3 },
  { label: "4",  value: 4 },
  { label: "5+", value: 5 },
];

export default function OwnerRequestPage() {
  const router = useRouter();
  const [count,     setCount]     = useState<number | null>(null);
  const [reason,    setReason]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = count !== null && reason.trim().length >= 10;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expired. Please log in again."); return; }

      const res = await fetch("/api/fleet/owner-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ vehicle_count: count, reason: reason.trim() }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to submit request"); return; }

      toast.success("Request submitted — we'll review within 24 hours");
      router.replace("/fleet/profile");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.back()} className="text-sub hover:text-text">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-display text-xl text-forest">Apply for Owner Access</h2>
          <p className="text-xs text-sub">Takes 24 hours to review</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-text mb-3">How many vehicles do you own?</p>
          <div className="flex gap-2">
            {COUNTS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setCount(value)}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  count === value
                    ? "bg-forest text-white border-forest"
                    : "bg-white text-sub border-border hover:border-leaf"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-text mb-2">Tell us about your vehicles</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="e.g. I own 3 SUVs on the Bhubaneswar–Cuttack route and want to manage them here."
            rows={4}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30 resize-none"
          />
          <p className={`text-xs mt-1 text-right ${reason.length >= 190 ? "text-red-400" : "text-sub"}`}>
            {reason.length}/200
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full bg-leaf text-white font-semibold py-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request →"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(fleet)/fleet/owner-request/page.tsx"
git commit -m "feat: owner request form page"
```

---

## Task 5: Profile page — owner upgrade card

**Files:**
- Modify: `src/app/(fleet)/fleet/profile/page.tsx`

Add the upgrade card below the existing online toggle button. The card has 4 states based on the user's request status and whether they already have the `owner` role.

- [ ] **Step 1: Add state + fetch to the profile page**

In `src/app/(fleet)/fleet/profile/page.tsx`, add these imports at the top:

```tsx
import Link from "next/link";
import { Building2 } from "lucide-react";
```

Add this state after the existing `useState` declarations (around line 33):

```tsx
const [ownerRequest, setOwnerRequest] = useState<{
  status: "PENDING" | "APPROVED" | "DECLINED";
} | null | undefined>(undefined); // undefined = not loaded yet
const [isOwner, setIsOwner] = useState(false);
```

In the `useEffect` (around line 35), after `setToken(t)`, add:

```tsx
// Check if already owner
const roles: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
setIsOwner(roles.includes("owner"));

// Fetch owner request status (only needed if not already an owner)
if (!roles.includes("owner")) {
  fetch("/api/fleet/owner-request", {
    headers: { Authorization: `Bearer ${t}` },
  })
    .then((r) => r.json())
    .then((j) => setOwnerRequest(j.data ?? null))
    .catch(() => setOwnerRequest(null));
}
```

- [ ] **Step 2: Add the upgrade card JSX**

In `src/app/(fleet)/fleet/profile/page.tsx`, after the closing `</button>` of the online toggle (around line 238), add this block inside the `{!loading && profile && (<>...</>)}` section:

```tsx
{/* ── Owner upgrade card ───────────────────────────── */}
{!isOwner && ownerRequest !== undefined && (
  <div className="mt-4">
    {ownerRequest === null && (
      <div className="bg-pale border border-leaf rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-leaf flex-shrink-0" />
          <p className="text-sm font-semibold text-forest">Own a fleet?</p>
        </div>
        <p className="text-xs text-sub mb-3">
          Own 2+ vehicles? Apply to manage them on Green Rides.
        </p>
        <Link
          href="/fleet/owner-request"
          className="inline-block bg-leaf text-white text-xs font-semibold px-4 py-2 rounded-xl"
        >
          Apply for Owner Access →
        </Link>
      </div>
    )}

    {ownerRequest?.status === "PENDING" && (
      <div className="bg-amber-50 border border-amber-400 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-text">Owner request pending</p>
        </div>
        <p className="text-xs text-sub">
          Your application is under review. We&apos;ll notify you once approved.
        </p>
      </div>
    )}

    {ownerRequest?.status === "DECLINED" && (
      <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
        <p className="text-sm font-semibold text-text mb-1">Request not approved</p>
        <p className="text-xs text-sub mb-3">
          You can reapply with updated details.
        </p>
        <Link
          href="/fleet/owner-request"
          className="inline-block bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
        >
          Reapply →
        </Link>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

Start the dev server: `npm run dev`

Open `driver.greenrides.co.in/fleet/profile` (or `localhost:3000/fleet/profile`) as a driver-only user.

Expected: The "Own a fleet?" green card appears below the online toggle button.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(fleet)/fleet/profile/page.tsx"
git commit -m "feat: owner upgrade card on driver profile page"
```

---

## Task 6: Layout — segmented pill toggle

**Files:**
- Modify: `src/app/(fleet)/fleet/layout.tsx`

Replace the current "Switch to Owner/Driver" text button in the header with a segmented pill that sits below the header bar.

- [ ] **Step 1: Remove the existing toggle button from the header**

In `src/app/(fleet)/fleet/layout.tsx`, find the `<header>` block (lines 83–106). Replace the entire header block with:

```tsx
<header className="bg-forest px-4 pt-safe-top pb-4 flex items-center justify-between">
  <div className="pt-2">
    <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest">Green Rides Fleet</p>
    <h1 className="font-display text-xl text-white capitalize">{mode} Portal</h1>
  </div>
  {mode === "owner" && (
    <button
      onClick={() => supabase.auth.signOut().then(() => router.replace("/fleet/login"))}
      className="flex items-center gap-1.5 text-lime/70 hover:text-lime text-xs font-medium"
    >
      <LogOut className="w-4 h-4" /> Sign out
    </button>
  )}
</header>
```

- [ ] **Step 2: Add the segmented pill below the header**

In `src/app/(fleet)/fleet/layout.tsx`, find the `<main>` line (currently around line 108):

```tsx
<main className={isPublicPath ? "flex-1" : "flex-1 pb-20"}>{children}</main>
```

Replace it with:

```tsx
{canToggle && !isPublicPath && (
  <div className="px-4 pt-3 pb-1 bg-cream">
    <div className="flex bg-white border border-border rounded-full p-1 gap-1">
      <button
        onClick={() => setMode("driver")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-colors ${
          mode === "driver" ? "bg-forest text-white" : "text-sub"
        }`}
      >
        <Car className="w-3.5 h-3.5" /> Driver
      </button>
      <button
        onClick={() => setMode("owner")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-colors ${
          mode === "owner" ? "bg-forest text-white" : "text-sub"
        }`}
      >
        <Building2 className="w-3.5 h-3.5" /> Owner
      </button>
    </div>
  </div>
)}
<main className={isPublicPath ? "flex-1" : "flex-1 pb-20"}>{children}</main>
```

- [ ] **Step 3: Add Building2 to the imports**

At the top of `src/app/(fleet)/fleet/layout.tsx`, update the lucide-react import to include `Building2`:

```tsx
import { Car, Calendar, User, Bell, LayoutDashboard, Truck, Users, TrendingUp, History, LogOut, Building2 } from "lucide-react";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

Log in as a user with both `driver` and `owner` roles. Expected: the segmented pill appears below the header on all non-public pages. Tapping "Owner" switches the bottom nav to owner tabs. Tapping "Driver" switches back.

Log in as a driver-only user. Expected: no pill visible.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(fleet)/fleet/layout.tsx"
git commit -m "feat: segmented driver/owner pill below header, remove text toggle button"
```

---

## Task 7: Admin Approvals page — Owner Upgrades tab

**Files:**
- Modify: `src/app/(admin)/admin/approvals/page.tsx`

Add a second tab "Owner Upgrades" alongside the existing applicants list. The existing list becomes the "New Applications" tab.

- [ ] **Step 1: Replace the ApprovalsContent component**

Replace the entire contents of `src/app/(admin)/admin/approvals/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, User, ChevronLeft, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface Applicant {
  id: string;
  user_id: string;
  name: string | null;
  phone: string;
  license_number?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  email?: string | null;
  kind: "driver" | "owner";
}

interface OwnerUpgradeRequest {
  id: string;
  user_id: string;
  name: string | null;
  phone: string | null;
  vehicle_count: number;
  reason: string;
  months_active: number | null;
  created_at: string;
}

type Tab = "applications" | "upgrades";

function ApprovalsContent({ token }: { token: string }) {
  const [tab,          setTab]        = useState<Tab>("applications");
  const [applicants,   setApplicants] = useState<Applicant[]>([]);
  const [upgrades,     setUpgrades]   = useState<OwnerUpgradeRequest[]>([]);
  const [loadingApps,  setLoadingApps]  = useState(true);
  const [loadingUpgr,  setLoadingUpgr]  = useState(true);
  const [deciding,     setDeciding]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/applicants", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => {
        type RawDriver = {
          id: string; license_number: string | null; vehicle_type: string | null;
          vehicle_number: string | null;
          user: { id: string; name: string | null; phone: string };
        };
        type RawOwner = {
          id: string; name: string; phone: string; email: string | null;
          user: { id: string; name: string | null; phone: string };
        };
        const drivers: Applicant[] = (j.data?.drivers ?? []).map((d: RawDriver) => ({
          id: d.id, user_id: d.user.id, name: d.user.name, phone: d.user.phone,
          license_number: d.license_number, vehicle_type: d.vehicle_type,
          vehicle_number: d.vehicle_number, kind: "driver" as const,
        }));
        const owners: Applicant[] = (j.data?.owners ?? []).map((o: RawOwner) => ({
          id: o.id, user_id: o.user.id, name: o.name, phone: o.phone,
          email: o.email, kind: "owner" as const,
        }));
        setApplicants([...drivers, ...owners]);
      })
      .catch(() => toast.error("Failed to load applications"))
      .finally(() => setLoadingApps(false));
  }, [token]);

  useEffect(() => {
    fetch("/api/admin/owner-requests", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setUpgrades(j.data ?? []))
      .catch(() => toast.error("Failed to load owner requests"))
      .finally(() => setLoadingUpgr(false));
  }, [token]);

  async function decide(applicant: Applicant, action: "approve" | "reject") {
    setDeciding(applicant.id);
    try {
      const res = await fetch("/api/admin/applicants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ user_id: applicant.user_id, action, applicant_type: applicant.kind }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      toast.success(action === "approve" ? "Approved!" : "Rejected");
      setApplicants((prev) => prev.filter((a) => !(a.id === applicant.id && a.kind === applicant.kind)));
    } catch { toast.error("Network error"); }
    finally { setDeciding(null); }
  }

  async function decideUpgrade(req: OwnerUpgradeRequest, action: "approve" | "decline") {
    setDeciding(req.id);
    try {
      const res = await fetch(`/api/admin/owner-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      toast.success(action === "approve" ? "Owner access granted!" : "Request declined");
      setUpgrades((prev) => prev.filter((u) => u.id !== req.id));
    } catch { toast.error("Network error"); }
    finally { setDeciding(null); }
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Fleet Approvals</h1>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="px-4 mt-4 mb-2 flex gap-2">
        <button
          onClick={() => setTab("applications")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
            tab === "applications"
              ? "bg-forest text-white border-forest"
              : "bg-white text-sub border-border"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          New Applications
          {applicants.length > 0 && (
            <span className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
              tab === "applications" ? "bg-white/20 text-white" : "bg-pale text-sub"
            }`}>
              {applicants.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("upgrades")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
            tab === "upgrades"
              ? "bg-forest text-white border-forest"
              : "bg-white text-sub border-border"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Owner Upgrades
          {upgrades.length > 0 && (
            <span className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
              tab === "upgrades" ? "bg-lime text-forest" : "bg-amber-100 text-amber-700"
            }`}>
              {upgrades.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 mt-2">
        {/* New Applications tab */}
        {tab === "applications" && (
          <>
            {loadingApps && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
            {!loadingApps && applicants.length === 0 && (
              <p className="text-center text-sub text-sm py-12">No pending applications.</p>
            )}
            {applicants.map((a) => (
              <div key={`${a.kind}-${a.id}`} className="bg-white border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-sub" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-text text-sm">{a.name ?? "Unknown"}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        a.kind === "driver" ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold"
                      }`}>{a.kind}</span>
                    </div>
                    <p className="text-xs text-sub">+91 {a.phone}</p>
                    {a.license_number && <p className="text-xs text-sub">License: {a.license_number}</p>}
                    {a.vehicle_number && <p className="text-xs text-sub">Vehicle: {a.vehicle_number} ({a.vehicle_type})</p>}
                    {a.email && <p className="text-xs text-sub">{a.email}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decide(a, "approve")} disabled={deciding === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-leaf/10 text-leaf text-sm font-semibold disabled:opacity-60">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => decide(a, "reject")} disabled={deciding === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-semibold disabled:opacity-60">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Owner Upgrades tab */}
        {tab === "upgrades" && (
          <>
            {loadingUpgr && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
            {!loadingUpgr && upgrades.length === 0 && (
              <p className="text-center text-sub text-sm py-12">No pending owner upgrade requests.</p>
            )}
            {upgrades.map((u) => (
              <div key={u.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-sub" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text text-sm">{u.name ?? "Unknown"}</p>
                    <p className="text-xs text-sub">
                      {u.phone ? `+91 ${u.phone}` : "No phone"}
                      {u.months_active !== null ? ` · Driver ${u.months_active} months` : ""}
                    </p>
                    <p className="text-xs text-leaf font-semibold mt-0.5">
                      Declared {u.vehicle_count} vehicle{u.vehicle_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="bg-pale rounded-xl px-3 py-2 mb-3 border-l-2 border-leaf">
                  <p className="text-xs text-sub italic">&ldquo;{u.reason.slice(0, 120)}{u.reason.length > 120 ? "…" : ""}&rdquo;</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decideUpgrade(u, "approve")} disabled={deciding === u.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-leaf text-white text-sm font-semibold disabled:opacity-60">
                    {deciding === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Grant Owner Access
                  </button>
                  <button onClick={() => decideUpgrade(u, "decline")} disabled={deciding === u.id}
                    className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-semibold disabled:opacity-60">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  return <AdminGate>{(token) => <ApprovalsContent token={token} />}</AdminGate>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test — admin approvals page**

Open `admin.greenrides.co.in/admin/approvals`. Expected:
- Two tab buttons appear: "New Applications" and "Owner Upgrades"
- Switching tabs works
- "Owner Upgrades" tab shows "No pending owner upgrade requests." when empty

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/approvals/page.tsx"
git commit -m "feat: owner upgrades tab in admin approvals page"
```

---

## Task 8: Push and verify deploy

- [ ] **Step 1: Final typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

Expected: GitHub Actions `Green Rides · Deploy` workflow triggers. Wait for it to pass (both Lint+Typecheck and Deploy Production jobs succeed).

- [ ] **Step 3: End-to-end verification**

**Driver flow:**
1. Open `driver.greenrides.co.in` → log in as a driver-only user
2. Go to Profile tab → verify "Own a fleet?" green card appears below the online toggle
3. Tap "Apply for Owner Access →" → verify form page opens with vehicle count chips and reason textarea
4. Select a count, enter a reason (10+ chars) → Submit → verify toast "Request submitted" and redirect to profile
5. Profile now shows "Owner request pending" amber card
6. The segmented pill does NOT appear (driver-only user)

**Admin flow:**
7. Open `admin.greenrides.co.in/admin/approvals` → click "Owner Upgrades" tab
8. The submitted request appears with driver name, tenure, vehicle count, reason
9. Tap "Grant Owner Access" → verify toast "Owner access granted!" and card disappears

**Post-approval:**
10. Driver logs out and logs back in on `driver.greenrides.co.in`
11. Go to Profile → "Own a fleet?" card is gone
12. The segmented pill (🚗 Driver | 🏢 Owner) now appears below the header
13. Tap "Owner" → bottom nav switches to owner tabs (Dashboard, My Fleet, Drivers, Earnings, Alerts)
14. Tap "Driver" → bottom nav switches back to driver tabs

- [ ] **Step 4: Done**

All 8 tasks complete. Feature is live on `driver.greenrides.co.in`, `owner.greenrides.co.in`, and `fleet.greenrides.co.in`.
