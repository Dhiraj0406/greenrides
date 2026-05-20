# Three-Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fleet (owner+driver) and standalone admin portals via subdomain routing while keeping the existing rider app intact.

**Architecture:** Single Next.js codebase, three subdomains routed in `proxy.ts` by hostname prefix. Fleet pages live under `/fleet/*` (`src/app/(fleet)/fleet/`), admin pages under `/admin/*` (`src/app/(admin)/admin/` — already exists). Roles stored in Supabase `app_metadata.roles` array.

**Tech Stack:** Next.js App Router, Prisma + PostgreSQL (Supabase), Tailwind CSS, `@supabase/auth-helpers-nextjs`, Lucide icons, Sonner toasts.

---

## File Map

**Create:**
```
prisma/schema.prisma                          (modify)
src/proxy.ts                                  (modify)
src/types/index.ts                            (modify)
src/lib/roles.ts                              (new)
src/app/(fleet)/fleet/layout.tsx              (new)
src/app/(fleet)/fleet/page.tsx                (new)
src/app/(fleet)/fleet/register/page.tsx       (new)
src/app/(fleet)/fleet/pending/page.tsx        (new)
src/app/(fleet)/fleet/today/page.tsx          (new)
src/app/(fleet)/fleet/history/page.tsx        (new)
src/app/(fleet)/fleet/availability/page.tsx   (new)
src/app/(fleet)/fleet/profile/page.tsx        (new)
src/app/(fleet)/fleet/notifications/page.tsx  (new)
src/app/(fleet)/fleet/dashboard/page.tsx      (new)
src/app/(fleet)/fleet/vehicles/page.tsx       (new)
src/app/(fleet)/fleet/vehicles/new/page.tsx   (new)
src/app/(fleet)/fleet/fleet-drivers/page.tsx  (new)
src/app/(fleet)/fleet/earnings/page.tsx       (new)
src/app/(admin)/admin/approvals/page.tsx      (new)
src/app/(admin)/admin/owners/page.tsx         (new)
src/app/(admin)/admin/payouts/page.tsx        (new)
src/app/api/fleet/register/route.ts           (new)
src/app/api/fleet/vehicles/route.ts           (new)
src/app/api/fleet/vehicles/[id]/route.ts      (new)
src/app/api/fleet/assign-driver/route.ts      (new)
src/app/api/fleet/availability/route.ts       (new)
src/app/api/fleet/notifications/route.ts      (new)
src/app/api/fleet/earnings/route.ts           (new)
src/app/api/admin/applicants/route.ts         (new)
src/app/api/admin/owners/route.ts             (new)
src/app/api/admin/owners/[id]/route.ts        (new)
src/app/api/admin/payouts/route.ts            (new)
src/app/api/admin/payouts/[id]/route.ts       (new)
```

---

## Task 1: Schema Extension

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add OWNER to UserRole enum and new models**

In `prisma/schema.prisma`, make these changes:

Replace the `UserRole` enum:
```prisma
enum UserRole {
  RIDER
  DRIVER
  OWNER
  ADMIN
}
```

Add after the `TelegramCode` model:
```prisma
// ─── OWNER (fleet account) ───────────────────────────
enum OwnerStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

model Owner {
  id         String      @id @default(uuid())
  user_id    String      @unique
  name       String
  phone      String
  email      String?
  status     OwnerStatus @default(PENDING)
  created_at DateTime    @default(now())

  user     User      @relation(fields: [user_id], references: [id])
  vehicles Vehicle[]
  payouts  OwnerPayout[]

  @@index([status])
}

// ─── VEHICLE ─────────────────────────────────────────
model Vehicle {
  id         String   @id @default(uuid())
  owner_id   String
  make       String
  model_name String
  number     String   @unique
  seats      Int      @default(4)
  active     Boolean  @default(true)
  driver_id  String?
  created_at DateTime @default(now())

  owner  Owner         @relation(fields: [owner_id], references: [id])
  driver DriverProfile? @relation(fields: [driver_id], references: [id])

  @@index([owner_id])
}

// ─── NOTIFICATION ─────────────────────────────────────
model Notification {
  id         String   @id @default(uuid())
  user_id    String
  type       String
  title      String
  body       String
  read       Boolean  @default(false)
  created_at DateTime @default(now())

  @@index([user_id, read])
}

// ─── OWNER PAYOUT ─────────────────────────────────────
enum PayoutStatus {
  PENDING
  PAID
}

model OwnerPayout {
  id          String       @id @default(uuid())
  owner_id    String
  amount_paise Int
  period_from DateTime
  period_to   DateTime
  status      PayoutStatus @default(PENDING)
  paid_at     DateTime?
  created_at  DateTime     @default(now())

  owner Owner @relation(fields: [owner_id], references: [id])

  @@index([owner_id])
}
```

Add `owner_id` and `vehicles` to `DriverProfile`:
```prisma
model DriverProfile {
  id             String   @id @default(uuid())
  user_id        String   @unique
  vehicle_type   String
  vehicle_number String
  vehicle_model  String
  license_number String
  license_photo  String?
  is_approved    Boolean  @default(false)
  avg_rating     Float    @default(0.0)
  total_trips    Int      @default(0)
  created_at     DateTime @default(now())
  is_online      Boolean  @default(false)
  telegram_chat_id String?
  availability   Json?
  approved_at    DateTime?
  owner_id       String?

  user     User     @relation(fields: [user_id], references: [id])
  vehicles Vehicle[]
}
```

Add `owner` relation to `User`:
```prisma
model User {
  // ... existing fields ...
  owner_profile Owner?
  // ... existing relations ...
}
```

- [ ] **Step 2: Push schema to database**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`.

- [ ] **Step 4: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Owner, Vehicle, Notification, OwnerPayout models"
```

---

## Task 2: Role Utilities

**Files:**
- Create: `src/lib/roles.ts`

- [ ] **Step 1: Write roles.ts**

```typescript
// src/lib/roles.ts
import { getAdminClient } from "@/lib/supabase";

export type FleetRole = "driver" | "owner" | "admin";

export function getRolesFromMetadata(appMetadata: Record<string, unknown>): string[] {
  const roles = appMetadata?.roles;
  if (Array.isArray(roles)) return roles as string[];
  return [];
}

export function hasFleetAccess(roles: string[]): boolean {
  return roles.includes("driver") || roles.includes("owner");
}

export function hasOwnerRole(roles: string[]): boolean {
  return roles.includes("owner");
}

export function hasDriverRole(roles: string[]): boolean {
  return roles.includes("driver");
}

export async function setUserRoles(
  userId: string,
  roles: string[],
  fleetStatus: "pending" | "active" | "suspended"
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { roles, fleet_status: fleetStatus },
  });
  if (error) throw new Error(`Failed to set roles: ${error.message}`);
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/roles.ts
git commit -m "feat(lib): add role utility helpers for fleet/admin access"
```

---

## Task 3: proxy.ts Hostname Routing

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Rewrite proxy.ts**

```typescript
// src/proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

const RIDER_PROTECTED = ["/bookings", "/profile"];

async function getSupabaseUser(req: NextRequest, res: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL    || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );
  return supabase.auth.getUser();
}

export async function proxy(req: NextRequest) {
  const host     = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;
  const res      = NextResponse.next();

  // ── Admin subdomain ──────────────────────────────────
  if (host.startsWith("admin.")) {
    const url = req.nextUrl.clone();
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`;

    const adminCookie = req.cookies.get("green_admin_token")?.value;
    if (adminCookie && adminCookie === process.env.ADMIN_SECRET) {
      return NextResponse.rewrite(url);
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Fleet subdomain ──────────────────────────────────
  if (host.startsWith("fleet.")) {
    const url = req.nextUrl.clone();
    url.pathname = `/fleet${pathname === "/" ? "" : pathname}`;

    // Register and pending pages are public on fleet subdomain
    if (pathname === "/register" || pathname === "/pending" || pathname === "/login") {
      return NextResponse.rewrite(url);
    }

    const { data: { user } } = await getSupabaseUser(req, res);

    if (!user) {
      const loginUrl = new URL("/fleet/register", req.url);
      loginUrl.host  = host;
      return NextResponse.redirect(`${req.nextUrl.protocol}//${host}/register`);
    }

    const roles: string[] = (user.app_metadata?.roles as string[]) ?? [];
    const hasFleet = roles.includes("driver") || roles.includes("owner");

    if (!hasFleet) {
      const fleetStatus = user.app_metadata?.fleet_status as string | undefined;
      if (fleetStatus === "pending") {
        return NextResponse.redirect(`${req.nextUrl.protocol}//${host}/pending`);
      }
      return NextResponse.redirect(`${req.nextUrl.protocol}//${host}/register`);
    }

    return NextResponse.rewrite(url);
  }

  // ── Rider portal (main domain) — path-based protection ──
  const isProtected = RIDER_PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const { data: { user } } = await getSupabaseUser(req, res);
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(proxy): add hostname-based routing for admin and fleet subdomains"
```

---

## Task 4: New Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Append fleet types**

Add to the end of `src/types/index.ts`:

```typescript
// ── Fleet types ──────────────────────────────────────────────────────────────

export type OwnerStatus  = "PENDING" | "ACTIVE" | "SUSPENDED";
export type PayoutStatus = "PENDING" | "PAID";
export type FleetStatus  = "pending" | "active" | "suspended"; // app_metadata value

export interface OwnerProfile {
  id:         string;
  user_id:    string;
  name:       string;
  phone:      string;
  email:      string | null;
  status:     OwnerStatus;
  created_at: string;
}

export interface Vehicle {
  id:          string;
  owner_id:    string;
  make:        string;
  model_name:  string;
  number:      string;
  seats:       number;
  active:      boolean;
  driver_id:   string | null;
  created_at:  string;
  driver?:     { id: string; user: { name: string | null; phone: string } };
}

export interface FleetNotification {
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  body:       string;
  read:       boolean;
  created_at: string;
}

export interface OwnerPayout {
  id:           string;
  owner_id:     string;
  amount_paise: number;
  period_from:  string;
  period_to:    string;
  status:       PayoutStatus;
  paid_at:      string | null;
  created_at:   string;
  owner?:       { name: string; phone: string };
}

export interface FleetApplicant {
  user_id:       string;
  name:          string | null;
  phone:         string;
  role:          "driver" | "owner" | "both";
  driver_profile?: {
    license_number: string;
    vehicle_type:   string;
    vehicle_number: string;
    vehicle_model:  string;
    is_approved:    boolean;
    created_at:     string;
  };
  owner_profile?: {
    id:         string;
    status:     OwnerStatus;
    created_at: string;
  };
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add fleet portal types (Owner, Vehicle, Notification, Payout)"
```

---

## Task 5: Fleet Registration API

**Files:**
- Create: `src/app/api/fleet/register/route.ts`

- [ ] **Step 1: Create route**

```typescript
// src/app/api/fleet/register/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  type:           z.enum(["driver", "owner", "both"]),
  name:           z.string().min(2),
  phone:          z.string().min(10),
  // driver fields
  license_number: z.string().optional(),
  vehicle_type:   z.string().optional(),
  vehicle_number: z.string().optional(),
  vehicle_model:  z.string().optional(),
  // owner fields
  email:          z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const adminClient = getAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
  const userId = authData.user.id;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const isDriver = d.type === "driver" || d.type === "both";
    const isOwner  = d.type === "owner"  || d.type === "both";

    // Update base User name/phone
    await prisma.user.update({
      where: { id: userId },
      data:  { name: d.name, phone: d.phone },
    });

    if (isDriver) {
      if (!d.license_number || !d.vehicle_type || !d.vehicle_number || !d.vehicle_model) {
        return Response.json({ data: null, error: "Driver fields required" }, { status: 400 });
      }
      await prisma.driverProfile.upsert({
        where:  { user_id: userId },
        create: {
          user_id:        userId,
          license_number: d.license_number,
          vehicle_type:   d.vehicle_type,
          vehicle_number: d.vehicle_number,
          vehicle_model:  d.vehicle_model,
          is_approved:    false,
        },
        update: {
          license_number: d.license_number,
          vehicle_type:   d.vehicle_type,
          vehicle_number: d.vehicle_number,
          vehicle_model:  d.vehicle_model,
        },
      });
    }

    if (isOwner) {
      await prisma.owner.upsert({
        where:  { user_id: userId },
        create: { user_id: userId, name: d.name, phone: d.phone, email: d.email ?? null },
        update: { name: d.name, phone: d.phone, email: d.email ?? null },
      });
    }

    // Mark fleet_status as pending in app_metadata (no roles yet — admin grants those)
    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { fleet_status: "pending" },
    });

    return Response.json({ data: { registered: true }, error: null });
  } catch (err) {
    console.error("[fleet/register]", err);
    return Response.json({ data: null, error: "Registration failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fleet/register/route.ts
git commit -m "feat(api): fleet registration endpoint"
```

---

## Task 6: Admin Applicants API

**Files:**
- Create: `src/app/api/admin/applicants/route.ts`

- [ ] **Step 1: Create route**

```typescript
// src/app/api/admin/applicants/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

// GET /api/admin/applicants — list pending fleet applicants
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const [pendingDrivers, pendingOwners] = await Promise.all([
      prisma.driverProfile.findMany({
        where:   { is_approved: false },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { created_at: "desc" },
      }),
      prisma.owner.findMany({
        where:   { status: "PENDING" },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return Response.json({ data: { drivers: pendingDrivers, owners: pendingOwners }, error: null });
  } catch (err) {
    console.error("[admin/applicants GET]", err);
    return Response.json({ data: null, error: "Failed to fetch" }, { status: 500 });
  }
}

// PATCH /api/admin/applicants — approve or reject an applicant
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { user_id, action, applicant_type } = await req.json().catch(() => ({}));
  if (!user_id || !action || !applicant_type) {
    return Response.json({ data: null, error: "user_id, action, applicant_type required" }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return Response.json({ data: null, error: "action must be approve or reject" }, { status: 400 });
  }
  if (!["driver", "owner", "both"].includes(applicant_type)) {
    return Response.json({ data: null, error: "Invalid applicant_type" }, { status: 400 });
  }

  const adminClient = getAdminClient();

  try {
    if (action === "approve") {
      const isDriver = applicant_type === "driver" || applicant_type === "both";
      const isOwner  = applicant_type === "owner"  || applicant_type === "both";

      const roles: string[] = [];

      if (isDriver) {
        await prisma.driverProfile.update({
          where: { user_id },
          data:  { is_approved: true, approved_at: new Date() },
        });
        await prisma.user.update({ where: { id: user_id }, data: { role: "DRIVER" } });
        roles.push("driver");
      }

      if (isOwner) {
        await prisma.owner.update({
          where: { user_id },
          data:  { status: "ACTIVE" },
        });
        if (!roles.includes("owner")) {
          await prisma.user.update({ where: { id: user_id }, data: { role: "OWNER" } });
        }
        roles.push("owner");
      }

      await adminClient.auth.admin.updateUserById(user_id, {
        app_metadata: { roles, fleet_status: "active" },
      });

      // Create in-app notification
      const user = await prisma.user.findUnique({ where: { id: user_id }, select: { name: true } });
      await prisma.notification.create({
        data: {
          user_id,
          type:  "application_approved",
          title: "Application Approved!",
          body:  `Welcome to Green Rides fleet, ${user?.name ?? ""}. You can now log in.`,
        },
      });
    } else {
      // reject — clear fleet_status
      await adminClient.auth.admin.updateUserById(user_id, {
        app_metadata: { fleet_status: "rejected" },
      });
    }

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error("[admin/applicants PATCH]", err);
    return Response.json({ data: null, error: "Action failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/applicants/route.ts
git commit -m "feat(api): admin applicants endpoint (list pending + approve/reject)"
```

---

## Task 7: Fleet Vehicles API

**Files:**
- Create: `src/app/api/fleet/vehicles/route.ts`
- Create: `src/app/api/fleet/vehicles/[id]/route.ts`

- [ ] **Step 1: Create vehicles list + create route**

```typescript
// src/app/api/fleet/vehicles/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

async function getOwner(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return null;
  return prisma.owner.findUnique({ where: { user_id: data.user.id } });
}

const createSchema = z.object({
  make:       z.string().min(1),
  model_name: z.string().min(1),
  number:     z.string().min(1),
  seats:      z.number().int().min(1).max(20).default(4),
});

export async function GET(req: NextRequest) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where:   { owner_id: owner.id },
    include: { driver: { include: { user: { select: { name: true, phone: true } } } } },
    orderBy: { created_at: "desc" },
  });
  return Response.json({ data: vehicles, error: null });
}

export async function POST(req: NextRequest) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (owner.status !== "ACTIVE") {
    return Response.json({ data: null, error: "Account not active" }, { status: 403 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: { ...parsed.data, owner_id: owner.id },
    });
    return Response.json({ data: vehicle, error: null }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002") {
      return Response.json({ data: null, error: "Vehicle number already registered" }, { status: 409 });
    }
    console.error("[fleet/vehicles POST]", err);
    return Response.json({ data: null, error: "Failed to create vehicle" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create vehicle update/deactivate route**

```typescript
// src/app/api/fleet/vehicles/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

async function getOwner(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return null;
  return prisma.owner.findUnique({ where: { user_id: data.user.id } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await getOwner(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({ where: { id, owner_id: owner.id } });
  if (!vehicle) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  const body   = await req.json().catch(() => ({}));
  const { active, driver_id } = body as { active?: boolean; driver_id?: string | null };

  const updated = await prisma.vehicle.update({
    where: { id },
    data:  {
      ...(active !== undefined ? { active } : {}),
      ...(driver_id !== undefined ? { driver_id } : {}),
    },
  });
  return Response.json({ data: updated, error: null });
}
```

- [ ] **Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fleet/vehicles/
git commit -m "feat(api): fleet vehicles CRUD endpoints"
```

---

## Task 8: Fleet Availability + Notifications APIs

**Files:**
- Create: `src/app/api/fleet/availability/route.ts`
- Create: `src/app/api/fleet/notifications/route.ts`

- [ ] **Step 1: Availability toggle**

```typescript
// src/app/api/fleet/availability/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function PATCH(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { is_online } = await req.json().catch(() => ({}));
  if (typeof is_online !== "boolean") {
    return Response.json({ data: null, error: "is_online (boolean) required" }, { status: 400 });
  }

  const profile = await prisma.driverProfile.findUnique({ where: { user_id: data.user.id } });
  if (!profile || !profile.is_approved) {
    return Response.json({ data: null, error: "Not a driver" }, { status: 403 });
  }

  await prisma.driverProfile.update({ where: { user_id: data.user.id }, data: { is_online } });
  return Response.json({ data: { is_online }, error: null });
}
```

- [ ] **Step 2: Notifications API**

```typescript
// src/app/api/fleet/notifications/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await getAdminClient().auth.getUser(token);
  return data.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where:   { user_id: userId },
    orderBy: { created_at: "desc" },
    take:    50,
  });
  const unread = notifications.filter((n) => !n.read).length;
  return Response.json({ data: { notifications, unread }, error: null });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids)) {
    return Response.json({ data: null, error: "ids array required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: { in: ids }, user_id: userId },
    data:  { read: true },
  });
  return Response.json({ data: { marked: ids.length }, error: null });
}
```

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/api/fleet/availability/route.ts src/app/api/fleet/notifications/route.ts
git commit -m "feat(api): fleet availability toggle and notifications endpoints"
```

---

## Task 9: Fleet Earnings + Admin Payouts APIs

**Files:**
- Create: `src/app/api/fleet/earnings/route.ts`
- Create: `src/app/api/admin/owners/route.ts`
- Create: `src/app/api/admin/owners/[id]/route.ts`
- Create: `src/app/api/admin/payouts/route.ts`
- Create: `src/app/api/admin/payouts/[id]/route.ts`

- [ ] **Step 1: Owner earnings**

```typescript
// src/app/api/fleet/earnings/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const { data } = await getAdminClient().auth.getUser(token);
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const owner = await prisma.owner.findUnique({ where: { user_id: data.user.id } });
  if (!owner) return Response.json({ data: null, error: "Not an owner" }, { status: 403 });

  const vehicles = await prisma.vehicle.findMany({ where: { owner_id: owner.id }, select: { id: true } });
  const vehicleIds = vehicles.map((v) => v.id);

  const [bookings, payouts] = await Promise.all([
    prisma.booking.findMany({
      where:   { ride: { driver_id: { in: vehicleIds } }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      include: { ride: { select: { from_city: true, to_city: true, departure_time: true } } },
      orderBy: { created_at: "desc" },
      take:    100,
    }),
    prisma.ownerPayout.findMany({
      where:   { owner_id: owner.id },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const totalEarned = bookings.reduce((s, b) => s + b.amount_paise, 0);
  return Response.json({ data: { bookings, payouts, totalEarned }, error: null });
}
```

- [ ] **Step 2: Admin owners list + status**

```typescript
// src/app/api/admin/owners/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const owners = await prisma.owner.findMany({
    include: {
      user:     { select: { name: true, phone: true } },
      vehicles: { select: { id: true, active: true } },
    },
    orderBy: { created_at: "desc" },
  });
  return Response.json({ data: owners, error: null });
}
```

```typescript
// src/app/api/admin/owners/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const { id }     = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    return Response.json({ data: null, error: "status must be ACTIVE or SUSPENDED" }, { status: 400 });
  }
  const owner = await prisma.owner.update({ where: { id }, data: { status } });
  return Response.json({ data: owner, error: null });
}
```

- [ ] **Step 3: Admin payouts**

```typescript
// src/app/api/admin/payouts/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const createSchema = z.object({
  owner_id:     z.string().uuid(),
  amount_paise: z.number().int().positive(),
  period_from:  z.string().datetime(),
  period_to:    z.string().datetime(),
});

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const payouts = await prisma.ownerPayout.findMany({
    include: { owner: { select: { user: { select: { name: true, phone: true } } } } },
    orderBy: { created_at: "desc" },
  });
  return Response.json({ data: payouts, error: null });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }
  const payout = await prisma.ownerPayout.create({ data: parsed.data });
  return Response.json({ data: payout, error: null }, { status: 201 });
}
```

```typescript
// src/app/api/admin/payouts/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const payout = await prisma.ownerPayout.update({
    where: { id },
    data:  { status: "PAID", paid_at: new Date() },
  });
  return Response.json({ data: payout, error: null });
}
```

- [ ] **Step 4: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/api/fleet/earnings/ src/app/api/admin/owners/ src/app/api/admin/payouts/
git commit -m "feat(api): fleet earnings, admin owners and payouts endpoints"
```

---

## Task 10: Fleet Portal Layout

**Files:**
- Create: `src/app/(fleet)/fleet/layout.tsx`
- Create: `src/app/(fleet)/fleet/page.tsx`

- [ ] **Step 1: Create fleet layout**

```typescript
// src/app/(fleet)/fleet/layout.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Calendar, Clock, User, Bell, LayoutDashboard, Truck, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "driver" | "owner";

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode]       = useState<Mode>("driver");
  const [roles, setRoles]     = useState<string[]>([]);
  const [unread, setUnread]   = useState(0);
  const [token, setToken]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      const r: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
      setRoles(r);
      // default mode: owner if has owner role, otherwise driver
      if (r.includes("owner") && !r.includes("driver")) setMode("owner");
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/fleet/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data) setUnread(j.data.unread); });
  }, [token]);

  const isOwner  = roles.includes("owner");
  const isDriver = roles.includes("driver");
  const canToggle = isOwner && isDriver;

  const driverNav = [
    { href: "/fleet/today",         label: "Today",         icon: Calendar },
    { href: "/fleet/history",       label: "History",       icon: Clock },
    { href: "/fleet/availability",  label: "Availability",  icon: Car },
    { href: "/fleet/notifications", label: "Alerts",        icon: Bell, badge: unread },
    { href: "/fleet/profile",       label: "Profile",       icon: User },
  ];

  const ownerNav = [
    { href: "/fleet/dashboard",     label: "Dashboard",  icon: LayoutDashboard },
    { href: "/fleet/vehicles",      label: "My Fleet",   icon: Truck },
    { href: "/fleet/fleet-drivers", label: "Drivers",    icon: Users },
    { href: "/fleet/earnings",      label: "Earnings",   icon: TrendingUp },
    { href: "/fleet/notifications", label: "Alerts",     icon: Bell, badge: unread },
  ];

  const nav = mode === "owner" ? ownerNav : driverNav;

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="bg-forest px-4 pt-safe-top pb-4 flex items-center justify-between">
        <div className="pt-2">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest">Green Rides Fleet</p>
          <h1 className="font-display text-xl text-white capitalize">{mode} Portal</h1>
        </div>
        {canToggle && (
          <button
            onClick={() => setMode(mode === "driver" ? "owner" : "driver")}
            className="bg-leaf/20 text-lime text-xs font-semibold px-3 py-1.5 rounded-full border border-lime/30"
          >
            Switch to {mode === "driver" ? "Owner" : "Driver"}
          </button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">
        <div className="green-container flex justify-around py-2">
          {nav.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 relative ${active ? "text-leaf" : "text-sub"}`}>
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge && badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Create fleet index page**

```typescript
// src/app/(fleet)/fleet/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function FleetIndex() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/fleet/register"); return; }
      const roles: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
      if (roles.includes("owner") && !roles.includes("driver")) {
        router.replace("/fleet/dashboard");
      } else {
        router.replace("/fleet/today");
      }
    });
  }, [router]);

  return null;
}
```

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/(fleet)/
git commit -m "feat(fleet): fleet portal layout with role-based bottom nav and mode toggle"
```

---

## Task 11: Fleet Register + Pending Pages

**Files:**
- Create: `src/app/(fleet)/fleet/register/page.tsx`
- Create: `src/app/(fleet)/fleet/pending/page.tsx`

- [ ] **Step 1: Register page**

```typescript
// src/app/(fleet)/fleet/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type RegType = "driver" | "owner" | "both";

export default function FleetRegisterPage() {
  const router = useRouter();
  const [step, setStep]     = useState<"auth" | "form">("auth");
  const [phone, setPhone]   = useState("");
  const [otp, setOtp]       = useState("");
  const [type, setType]     = useState<RegType>("driver");
  const [form, setForm]     = useState({
    name: "", license_number: "", vehicle_type: "", vehicle_number: "", vehicle_model: "", email: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setStep("form");
    toast.success("OTP sent");
  }

  async function handleSubmit() {
    setLoading(true);
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`, token: otp, type: "sms",
    });
    if (verifyErr) { toast.error(verifyErr.message); setLoading(false); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Session error"); setLoading(false); return; }

    const res = await fetch("/api/fleet/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ type, ...form }),
    });
    const json = await res.json();
    setLoading(false);

    if (json.error) { toast.error(json.error); return; }
    router.replace("/fleet/pending");
  }

  const needsDriver = type === "driver" || type === "both";
  const needsOwner  = type === "owner"  || type === "both";

  return (
    <div className="green-container min-h-screen bg-cream px-4 py-8">
      <div className="mb-8">
        <p className="text-leaf text-xs font-mono-green uppercase tracking-widest mb-1">Green Rides</p>
        <h1 className="font-display text-3xl text-forest">Join the Fleet</h1>
        <p className="text-sm text-sub mt-1">Driver & owner registration</p>
      </div>

      {step === "auth" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-sub mb-1">Phone number</label>
            <div className="flex">
              <span className="bg-pale border border-border rounded-l-xl px-3 py-3 text-sm text-sub">+91</span>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="9XXXXXXXXX"
                className="flex-1 border border-l-0 border-border rounded-r-xl px-3 py-3 text-sm outline-none focus:ring-2 ring-leaf/30"
              />
            </div>
          </div>
          <button onClick={handleSendOtp} disabled={loading || phone.length < 10}
            className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get OTP"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-sub mb-1">OTP</label>
            <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">I am registering as</label>
            <div className="flex gap-2">
              {(["driver", "owner", "both"] as RegType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors
                    ${type === t ? "bg-leaf text-white border-leaf" : "bg-white text-sub border-border"}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {(["name"] as const).map((field) => (
            <input key={field} type="text" placeholder="Full name"
              value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
          ))}

          {needsDriver && (
            <>
              <input type="text" placeholder="License number"
                value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
              <input type="text" placeholder="Vehicle type (e.g. SUV, Sedan)"
                value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
              <input type="text" placeholder="Vehicle number (plate)"
                value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
              <input type="text" placeholder="Vehicle model (e.g. Innova Crysta)"
                value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
            </>
          )}

          {needsOwner && (
            <input type="email" placeholder="Email (optional)"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
          )}

          <button onClick={handleSubmit} disabled={loading || !form.name || !otp}
            className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Application"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pending page**

```typescript
// src/app/(fleet)/fleet/pending/page.tsx
import { Clock, Phone } from "lucide-react";

export default function FleetPendingPage() {
  return (
    <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-gold" />
      </div>
      <h1 className="font-display text-2xl text-forest mb-3">Application Under Review</h1>
      <p className="text-sm text-sub max-w-xs mb-6">
        Your application has been submitted. Our team reviews applications within 24–48 hours.
        You'll receive a notification once approved.
      </p>
      <a href="tel:+919999999999"
        className="flex items-center gap-2 text-sm text-leaf font-semibold">
        <Phone className="w-4 h-4" />
        Contact Support
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/(fleet)/fleet/register/ src/app/(fleet)/fleet/pending/
git commit -m "feat(fleet): registration form and pending review page"
```

---

## Task 12: Driver Mode Pages

**Files:**
- Create: `src/app/(fleet)/fleet/today/page.tsx`
- Create: `src/app/(fleet)/fleet/history/page.tsx`
- Create: `src/app/(fleet)/fleet/availability/page.tsx`
- Create: `src/app/(fleet)/fleet/profile/page.tsx`
- Create: `src/app/(fleet)/fleet/notifications/page.tsx`

- [ ] **Step 1: Today's rides**

```typescript
// src/app/(fleet)/fleet/today/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TodayRide {
  id: string; from_city: string; to_city: string;
  departure_time: string; pickup_point: string;
  rider: { name: string | null; phone: string };
  seats: number; amount_paise: number; status: string;
}

export default function TodayPage() {
  const [rides, setRides]     = useState<TodayRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const today = new Date().toISOString().split("T")[0];
      fetch(`/api/rides/driver?date=${today}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setRides(j.data ?? []); setLoading(false); });
    });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Today's Rides</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && rides.length === 0 && (
        <p className="text-center text-sub text-sm py-12">No rides scheduled for today.</p>
      )}
      {rides.map((ride) => (
        <div key={ride.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
            <MapPin className="w-4 h-4 text-leaf" />
            {ride.from_city} → {ride.to_city}
          </div>
          <div className="flex items-center gap-1 text-xs text-sub mb-3">
            <Clock className="w-3 h-3" />
            {new Date(ride.departure_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            · {ride.seats} seat{ride.seats > 1 ? "s" : ""}
            · ₹{Math.round(ride.amount_paise / 100)}
          </div>
          <div className="text-xs text-sub">
            Rider: <span className="font-semibold text-text">{ride.rider.name ?? "—"}</span>
            · <a href={`tel:${ride.rider.phone}`} className="text-leaf">{ride.rider.phone}</a>
          </div>
          <div className="text-xs text-sub mt-1">Pickup: {ride.pickup_point}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Availability toggle**

```typescript
// src/app/(fleet)/fleet/availability/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function AvailabilityPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [token, setToken]       = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      fetch("/api/fleet/driver/profile", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((j) => { if (j.data) setIsOnline(j.data.is_online); setLoading(false); });
    });
  }, []);

  async function toggle() {
    setSaving(true);
    const res  = await fetch("/api/fleet/availability", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ is_online: !isOnline }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.error) { toast.error(json.error); return; }
    setIsOnline(!isOnline);
    toast.success(isOnline ? "You're now offline" : "You're now online");
  }

  return (
    <div className="px-4 py-6 flex flex-col items-center text-center">
      <h2 className="font-display text-xl text-forest mb-8">Availability</h2>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      ) : (
        <>
          <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 transition-colors
            ${isOnline ? "bg-leaf/10 border-4 border-leaf" : "bg-gray-100 border-4 border-gray-300"}`}>
            <span className={`font-display text-xl ${isOnline ? "text-leaf" : "text-sub"}`}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <p className="text-sm text-sub mb-8">
            {isOnline ? "You're visible to riders and can receive bookings." : "You're hidden from riders. Toggle to go online."}
          </p>
          <button onClick={toggle} disabled={saving}
            className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors
              ${isOnline ? "bg-red-100 text-red-600" : "bg-leaf text-white"}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isOnline ? "Go Offline" : "Go Online")}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Notifications page**

```typescript
// src/app/(fleet)/fleet/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { FleetNotification } from "@/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<FleetNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken]     = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      fetch("/api/fleet/notifications", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((j) => { setNotifications(j.data?.notifications ?? []); setLoading(false); });
    });
  }, []);

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    await fetch("/api/fleet/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ ids: unread }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-forest">Notifications</h2>
        <button onClick={markAllRead} className="text-xs text-leaf font-semibold">Mark all read</button>
      </div>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="w-10 h-10 text-sub mb-3" />
          <p className="text-sub text-sm">No notifications yet.</p>
        </div>
      )}
      {notifications.map((n) => (
        <div key={n.id} className={`p-4 rounded-2xl mb-3 border ${n.read ? "bg-white border-border" : "bg-leaf/5 border-leaf/30"}`}>
          <p className="text-sm font-semibold text-text">{n.title}</p>
          <p className="text-xs text-sub mt-0.5">{n.body}</p>
          <p className="text-[10px] text-sub mt-2">
            {new Date(n.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: History page**

```typescript
// src/app/(fleet)/fleet/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface HistoryRide {
  id: string; from_city: string; to_city: string;
  departure_time: string; status: string;
  bookings: { amount_paise: number }[];
}

export default function HistoryPage() {
  const [rides, setRides]     = useState<HistoryRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/rides/driver?all=true", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((j) => { setRides(j.data ?? []); setLoading(false); });
    });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">Ride History</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && rides.length === 0 && <p className="text-center text-sub text-sm py-12">No past rides yet.</p>}
      {rides.map((ride) => {
        const earned = ride.bookings.reduce((s, b) => s + b.amount_paise, 0);
        return (
          <div key={ride.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text">{ride.from_city} → {ride.to_city}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                ${ride.status === "COMPLETED" ? "bg-leaf/10 text-leaf" : "bg-gray-100 text-sub"}`}>
                {ride.status}
              </span>
            </div>
            <p className="text-xs text-sub mt-1">
              {new Date(ride.departure_time).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            {earned > 0 && <p className="text-sm font-semibold text-forest mt-2">₹{Math.round(earned / 100)}</p>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Profile page**

```typescript
// src/app/(fleet)/fleet/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Profile { name: string | null; phone: string; vehicle_type: string; vehicle_number: string; vehicle_model: string; avg_rating: number; total_trips: number; }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      fetch("/api/fleet/driver/profile", {}).then((r) => r.json()).then((j) => { setProfile(j.data); setLoading(false); });
    });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-6">Profile</h2>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div> : (
        <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <Row label="Name"           value={profile?.name ?? "—"} />
          <Row label="Phone"          value={profile?.phone ?? "—"} />
          <Row label="Vehicle"        value={`${profile?.vehicle_model} · ${profile?.vehicle_number}`} />
          <Row label="Type"           value={profile?.vehicle_type ?? "—"} />
          <Row label="Rating"         value={profile?.avg_rating.toFixed(1) ?? "—"} />
          <Row label="Total Trips"    value={String(profile?.total_trips ?? 0)} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border last:border-0">
      <span className="text-xs text-sub">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}
```

- [ ] **Step 6: Add driver profile API**

```typescript
// src/app/api/fleet/driver/profile/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data } = await getAdminClient().auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.driverProfile.findUnique({
    where:   { user_id: data.user.id },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!profile) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  return Response.json({
    data: {
      name:           profile.user.name,
      phone:          profile.user.phone,
      vehicle_type:   profile.vehicle_type,
      vehicle_number: profile.vehicle_number,
      vehicle_model:  profile.vehicle_model,
      avg_rating:     profile.avg_rating,
      total_trips:    profile.total_trips,
      is_online:      profile.is_online,
    },
    error: null,
  });
}
```

Also add a driver rides API:

```typescript
// src/app/api/rides/driver/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data } = await getAdminClient().auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const all  = req.nextUrl.searchParams.get("all") === "true";
  const date = req.nextUrl.searchParams.get("date");

  const where: Record<string, unknown> = { driver_id: data.user.id };
  if (!all && date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end   = new Date(`${date}T23:59:59.999Z`);
    where.departure_time = { gte: start, lte: end };
  }

  const rides = await prisma.ride.findMany({
    where,
    include: {
      bookings: {
        where:   { status: { in: ["CONFIRMED", "COMPLETED"] } },
        include: { rider: { select: { name: true, phone: true } } },
        select:  { amount_paise: true, pickup_point: true, seats: true, status: true, rider: true },
      },
    },
    orderBy: { departure_time: "desc" },
    take:    all ? 100 : 10,
  });

  return Response.json({ data: rides, error: null });
}
```

- [ ] **Step 7: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/(fleet)/fleet/today/ src/app/(fleet)/fleet/history/ src/app/(fleet)/fleet/availability/ src/app/(fleet)/fleet/profile/ src/app/(fleet)/fleet/notifications/ src/app/api/fleet/driver/ src/app/api/rides/driver/
git commit -m "feat(fleet): driver mode pages (today, history, availability, profile, notifications)"
```

---

## Task 13: Owner Mode Pages

**Files:**
- Create: `src/app/(fleet)/fleet/dashboard/page.tsx`
- Create: `src/app/(fleet)/fleet/vehicles/page.tsx`
- Create: `src/app/(fleet)/fleet/vehicles/new/page.tsx`
- Create: `src/app/(fleet)/fleet/fleet-drivers/page.tsx`
- Create: `src/app/(fleet)/fleet/earnings/page.tsx`

- [ ] **Step 1: Owner dashboard**

```typescript
// src/app/(fleet)/fleet/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Truck, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/types";

export default function OwnerDashboard() {
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [earnings, setEarnings]   = useState(0);
  const [loading, setLoading]     = useState(true);
  const [token, setToken]         = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      const h = { Authorization: `Bearer ${session.access_token}` };
      Promise.all([
        fetch("/api/fleet/vehicles", { headers: h }).then((r) => r.json()),
        fetch("/api/fleet/earnings",  { headers: h }).then((r) => r.json()),
      ]).then(([vj, ej]) => {
        setVehicles(vj.data ?? []);
        setEarnings(ej.data?.totalEarned ?? 0);
        setLoading(false);
      });
    });
  }, []);

  const activeVehicles = vehicles.filter((v) => v.active).length;
  const assignedDrivers = vehicles.filter((v) => v.driver_id).length;

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-6">Fleet Overview</h2>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div> : (
        <>
          <div className="bg-forest rounded-2xl p-5 text-white mb-5">
            <p className="text-lime/60 text-xs uppercase tracking-wide mb-1">Total Earnings</p>
            <p className="font-display text-4xl">₹{Math.round(earnings / 100).toLocaleString("en-IN")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard icon={Truck}  label="Active Vehicles" value={activeVehicles}  href="/fleet/vehicles" />
            <StatCard icon={Users}  label="Assigned Drivers" value={assignedDrivers} href="/fleet/fleet-drivers" />
          </div>
          <Link href="/fleet/earnings"
            className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-leaf" />
              <span className="text-sm font-semibold text-text">View Earnings & Payouts</span>
            </div>
            <span className="text-sub">→</span>
          </Link>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-leaf/50 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-leaf/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-leaf" />
      </div>
      <div>
        <p className="font-display text-2xl text-forest">{value}</p>
        <p className="text-xs text-sub">{label}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Vehicles list**

```typescript
// src/app/(fleet)/fleet/vehicles/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/types";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      fetch("/api/fleet/vehicles", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((j) => { setVehicles(j.data ?? []); setLoading(false); });
    });
  }, []);

  async function toggleActive(id: string, active: boolean) {
    const res  = await fetch(`/api/fleet/vehicles/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ active }),
    });
    const json = await res.json();
    if (json.error) { toast.error(json.error); return; }
    setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, active } : v));
    toast.success(active ? "Vehicle activated" : "Vehicle deactivated");
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-forest">My Fleet</h2>
        <Link href="/fleet/vehicles/new"
          className="flex items-center gap-1 bg-leaf text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus className="w-3.5 h-3.5" /> Add Vehicle
        </Link>
      </div>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && vehicles.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Truck className="w-10 h-10 text-sub mb-3" />
          <p className="text-sub text-sm">No vehicles yet. Add your first vehicle.</p>
        </div>
      )}
      {vehicles.map((v) => (
        <div key={v.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-text text-sm">{v.make} {v.model_name}</p>
              <p className="text-xs text-sub">{v.number} · {v.seats} seats</p>
              {v.driver && (
                <p className="text-xs text-leaf mt-1">Driver: {v.driver.user.name ?? v.driver.user.phone}</p>
              )}
              {!v.driver_id && <p className="text-xs text-gold mt-1">No driver assigned</p>}
            </div>
            <button
              onClick={() => toggleActive(v.id, !v.active)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors
                ${v.active ? "bg-leaf/10 text-leaf border-leaf/30" : "bg-gray-100 text-sub border-gray-300"}`}>
              {v.active ? "Active" : "Inactive"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add vehicle form**

```typescript
// src/app/(fleet)/fleet/vehicles/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function NewVehiclePage() {
  const router = useRouter();
  const [form, setForm] = useState({ make: "", model_name: "", number: "", seats: "4" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not logged in"); setLoading(false); return; }

    const res  = await fetch("/api/fleet/vehicles", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ ...form, seats: parseInt(form.seats) }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.error) { toast.error(json.error); return; }
    toast.success("Vehicle added");
    router.replace("/fleet/vehicles");
  }

  const fields = [
    { key: "make",       placeholder: "Make (e.g. Toyota)",         type: "text" },
    { key: "model_name", placeholder: "Model (e.g. Innova Crysta)", type: "text" },
    { key: "number",     placeholder: "Plate number (e.g. OD01AB1234)", type: "text" },
    { key: "seats",      placeholder: "Number of seats",            type: "number" },
  ] as const;

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-6">Add Vehicle</h2>
      <div className="space-y-3">
        {fields.map(({ key, placeholder, type }) => (
          <input key={key} type={type} placeholder={placeholder}
            value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
        ))}
        <button onClick={handleSubmit} disabled={loading || !form.make || !form.model_name || !form.number}
          className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Vehicle"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Fleet drivers page**

```typescript
// src/app/(fleet)/fleet/fleet-drivers/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/types";

export default function FleetDriversPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      fetch("/api/fleet/vehicles", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((j) => { setVehicles(j.data ?? []); setLoading(false); });
    });
  }, []);

  async function unassign(vehicleId: string) {
    const res = await fetch(`/api/fleet/vehicles/${vehicleId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ driver_id: null }),
    });
    const json = await res.json();
    if (json.error) { toast.error(json.error); return; }
    setVehicles((prev) => prev.map((v) => v.id === vehicleId ? { ...v, driver_id: null, driver: undefined } : v));
    toast.success("Driver unassigned");
  }

  const withDrivers    = vehicles.filter((v) => v.driver_id);
  const withoutDrivers = vehicles.filter((v) => !v.driver_id && v.active);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-6">Fleet Drivers</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && vehicles.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Users className="w-10 h-10 text-sub mb-3" />
          <p className="text-sub text-sm">Add vehicles first, then assign drivers.</p>
        </div>
      )}
      {withDrivers.length > 0 && (
        <>
          <p className="text-xs text-sub uppercase tracking-wide font-semibold mb-2">Assigned</p>
          {withDrivers.map((v) => (
            <div key={v.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-text text-sm">{v.driver?.user.name ?? "—"}</p>
                  <p className="text-xs text-sub">{v.driver?.user.phone} · {v.make} {v.model_name} {v.number}</p>
                </div>
                <button onClick={() => unassign(v.id)}
                  className="text-xs text-red-500 font-semibold px-3 py-1.5 rounded-full border border-red-200 bg-red-50">
                  Unassign
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {withoutDrivers.length > 0 && (
        <>
          <p className="text-xs text-sub uppercase tracking-wide font-semibold mt-4 mb-2">Unassigned Vehicles</p>
          {withoutDrivers.map((v) => (
            <div key={v.id} className="bg-pale border border-border rounded-2xl p-4 mb-3">
              <p className="text-sm font-semibold text-text">{v.make} {v.model_name} · {v.number}</p>
              <p className="text-xs text-gold mt-0.5">No driver — contact admin to assign a driver</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Earnings page**

```typescript
// src/app/(fleet)/fleet/earnings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { OwnerPayout } from "@/types";

export default function EarningsPage() {
  const [data, setData]       = useState<{ totalEarned: number; payouts: OwnerPayout[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/fleet/earnings", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((j) => { setData(j.data); setLoading(false); });
    });
  }, []);

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-6">Earnings</h2>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div> : (
        <>
          <div className="bg-forest rounded-2xl p-5 text-white mb-6">
            <p className="text-lime/60 text-xs uppercase tracking-wide mb-1">Total Platform Earnings</p>
            <p className="font-display text-4xl">₹{Math.round((data?.totalEarned ?? 0) / 100).toLocaleString("en-IN")}</p>
          </div>
          <h3 className="text-sm font-semibold text-text mb-3">Payout History</h3>
          {(data?.payouts ?? []).length === 0 && <p className="text-sm text-sub">No payouts yet.</p>}
          {(data?.payouts ?? []).map((p) => (
            <div key={p.id} className="bg-white border border-border rounded-2xl p-4 mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text">₹{Math.round(p.amount_paise / 100).toLocaleString("en-IN")}</p>
                <p className="text-xs text-sub">
                  {new Date(p.period_from).toLocaleDateString("en-IN")} – {new Date(p.period_to).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full
                ${p.status === "PAID" ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold"}`}>
                {p.status}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/(fleet)/fleet/dashboard/ src/app/(fleet)/fleet/vehicles/ src/app/(fleet)/fleet/fleet-drivers/ src/app/(fleet)/fleet/earnings/
git commit -m "feat(fleet): owner mode pages (dashboard, vehicles, fleet-drivers, earnings)"
```

---

## Task 14: Admin Portal — Approvals + Owners + Payouts Pages

**Files:**
- Create: `src/app/(admin)/admin/approvals/page.tsx`
- Create: `src/app/(admin)/admin/owners/page.tsx`
- Create: `src/app/(admin)/admin/payouts/page.tsx`
- Modify: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Approvals page**

```typescript
// src/app/(admin)/admin/approvals/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface DriverApplicant {
  user_id: string; user: { name: string | null; phone: string };
  license_number: string; vehicle_type: string; vehicle_number: string; created_at: string;
}
interface OwnerApplicant {
  user_id: string; user: { name: string | null; phone: string };
  email: string | null; created_at: string;
}

function Approvals({ token }: { token: string }) {
  const [drivers, setDrivers] = useState<DriverApplicant[]>([]);
  const [owners,  setOwners]  = useState<OwnerApplicant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/applicants", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setDrivers(j.data?.drivers ?? []); setOwners(j.data?.owners ?? []); setLoading(false); });
  }, [token]);

  async function decide(userId: string, applicantType: string, action: "approve" | "reject") {
    const res  = await fetch("/api/admin/applicants", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body:    JSON.stringify({ user_id: userId, action, applicant_type: applicantType }),
    });
    const json = await res.json();
    if (json.error) { toast.error(json.error); return; }
    toast.success(`${action === "approve" ? "Approved" : "Rejected"} successfully`);
    setDrivers((p) => p.filter((d) => d.user_id !== userId));
    setOwners((p)  => p.filter((o) => o.user_id !== userId));
  }

  const total = drivers.length + owners.length;

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Admin</p>
          <h1 className="font-display text-2xl text-white">Approvals {total > 0 && `(${total})`}</h1>
        </div>
      </header>
      <div className="px-4 mt-6">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
        {!loading && total === 0 && <p className="text-center text-sub text-sm py-12">No pending applications.</p>}

        {drivers.length > 0 && (
          <>
            <p className="text-xs text-sub uppercase tracking-wide font-semibold mb-2">Driver Applications</p>
            {drivers.map((d) => (
              <ApplicantCard key={d.user_id} name={d.user.name} phone={d.user.phone}
                meta={`${d.vehicle_type} · ${d.vehicle_number}`}
                onApprove={() => decide(d.user_id, "driver", "approve")}
                onReject={()  => decide(d.user_id, "driver", "reject")} />
            ))}
          </>
        )}

        {owners.length > 0 && (
          <>
            <p className="text-xs text-sub uppercase tracking-wide font-semibold mt-4 mb-2">Owner Applications</p>
            {owners.map((o) => (
              <ApplicantCard key={o.user_id} name={o.user.name} phone={o.user.phone}
                meta={o.email ?? "No email"}
                onApprove={() => decide(o.user_id, "owner", "approve")}
                onReject={()  => decide(o.user_id, "owner", "reject")} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ApplicantCard({ name, phone, meta, onApprove, onReject }: {
  name: string | null; phone: string; meta: string;
  onApprove: () => void; onReject: () => void;
}) {
  return (
    <div className="bg-white border border-border rounded-2xl p-4 mb-3">
      <p className="font-semibold text-text text-sm">{name ?? "—"} · {phone}</p>
      <p className="text-xs text-sub mt-0.5 mb-3">{meta}</p>
      <div className="flex gap-2">
        <button onClick={onApprove}
          className="flex items-center gap-1 bg-leaf/10 text-leaf text-xs font-semibold px-3 py-2 rounded-xl border border-leaf/30">
          <CheckCircle className="w-3.5 h-3.5" /> Approve
        </button>
        <button onClick={onReject}
          className="flex items-center gap-1 bg-red-50 text-red-500 text-xs font-semibold px-3 py-2 rounded-xl border border-red-200">
          <XCircle className="w-3.5 h-3.5" /> Reject
        </button>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  return <AdminGate>{(token) => <Approvals token={token} />}</AdminGate>;
}
```

- [ ] **Step 2: Owners management page**

```typescript
// src/app/(admin)/admin/owners/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import type { OwnerProfile } from "@/types";

interface OwnerRow extends OwnerProfile {
  user: { name: string | null; phone: string };
  vehicles: { id: string; active: boolean }[];
}

function Owners({ token }: { token: string }) {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/owners", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setOwners(j.data ?? []); setLoading(false); });
  }, [token]);

  async function toggleStatus(id: string, current: string) {
    const status = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res    = await fetch(`/api/admin/owners/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body:    JSON.stringify({ status }),
    });
    const json   = await res.json();
    if (json.error) { toast.error(json.error); return; }
    setOwners((p) => p.map((o) => o.id === id ? { ...o, status } as OwnerRow : o));
    toast.success(`Owner ${status === "ACTIVE" ? "activated" : "suspended"}`);
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Admin</p>
          <h1 className="font-display text-2xl text-white">Owners</h1>
        </div>
      </header>
      <div className="px-4 mt-6">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
        {!loading && owners.length === 0 && <p className="text-center text-sub text-sm py-12">No owners yet.</p>}
        {owners.map((o) => (
          <div key={o.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-text text-sm">{o.user.name ?? "—"}</p>
                <p className="text-xs text-sub">{o.user.phone} · {o.vehicles.length} vehicles</p>
              </div>
              <button onClick={() => toggleStatus(o.id, o.status)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border
                  ${o.status === "ACTIVE" ? "bg-leaf/10 text-leaf border-leaf/30" : "bg-red-50 text-red-500 border-red-200"}`}>
                {o.status}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OwnersPage() {
  return <AdminGate>{(token) => <Owners token={token} />}</AdminGate>;
}
```

- [ ] **Step 3: Payouts page**

```typescript
// src/app/(admin)/admin/payouts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import type { OwnerPayout } from "@/types";

interface PayoutRow extends OwnerPayout {
  owner: { user: { name: string | null; phone: string } };
}

function Payouts({ token }: { token: string }) {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/payouts", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setPayouts(j.data ?? []); setLoading(false); });
  }, [token]);

  async function markPaid(id: string) {
    const res  = await fetch(`/api/admin/payouts/${id}`, {
      method:  "PATCH",
      headers: { "x-admin-token": token },
    });
    const json = await res.json();
    if (json.error) { toast.error(json.error); return; }
    setPayouts((p) => p.map((payout) => payout.id === id ? { ...payout, status: "PAID" as const } : payout));
    toast.success("Marked as paid");
  }

  const pending = payouts.filter((p) => p.status === "PENDING");
  const paid    = payouts.filter((p) => p.status === "PAID");

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Admin</p>
          <h1 className="font-display text-2xl text-white">Payouts</h1>
        </div>
      </header>
      <div className="px-4 mt-6">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}

        {pending.length > 0 && (
          <>
            <p className="text-xs text-sub uppercase tracking-wide font-semibold mb-2">Pending</p>
            {pending.map((p) => (
              <div key={p.id} className="bg-white border border-gold/30 rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-text text-sm">{p.owner.user.name ?? p.owner.user.phone}</p>
                    <p className="font-display text-lg text-forest">₹{Math.round(p.amount_paise / 100).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-sub">
                      {new Date(p.period_from).toLocaleDateString("en-IN")} – {new Date(p.period_to).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <button onClick={() => markPaid(p.id)}
                    className="text-xs bg-leaf text-white font-semibold px-3 py-2 rounded-xl">
                    Mark Paid
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {paid.length > 0 && (
          <>
            <p className="text-xs text-sub uppercase tracking-wide font-semibold mt-4 mb-2">Paid</p>
            {paid.map((p) => (
              <div key={p.id} className="bg-white border border-border rounded-2xl p-4 mb-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-text text-sm">{p.owner.user.name ?? p.owner.user.phone}</p>
                  <p className="text-sm text-forest font-semibold">₹{Math.round(p.amount_paise / 100).toLocaleString("en-IN")}</p>
                </div>
                <span className="text-xs bg-leaf/10 text-leaf font-semibold px-2 py-1 rounded-full">PAID</span>
              </div>
            ))}
          </>
        )}

        {!loading && payouts.length === 0 && <p className="text-center text-sub text-sm py-12">No payouts yet.</p>}
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  return <AdminGate>{(token) => <Payouts token={token} />}</AdminGate>;
}
```

- [ ] **Step 4: Add links to existing admin dashboard**

In `src/app/(admin)/admin/page.tsx`, inside the `cards` array, add:
```typescript
{ label: "Approvals", value: "→", icon: Users, color: "text-leaf bg-leaf/10", href: "/admin/approvals" },
```

And in the links section, add:
```typescript
<Link href="/admin/approvals" className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
  <div className="flex items-center gap-3">
    <Users className="w-5 h-5 text-leaf" />
    <span className="text-sm font-semibold text-text">Fleet Approvals</span>
  </div>
  <span className="text-sub text-sm">→</span>
</Link>
<Link href="/admin/owners" className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
  <div className="flex items-center gap-3">
    <Users className="w-5 h-5 text-leaf" />
    <span className="text-sm font-semibold text-text">Owners</span>
  </div>
  <span className="text-sub text-sm">→</span>
</Link>
<Link href="/admin/payouts" className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
  <div className="flex items-center gap-3">
    <IndianRupee className="w-5 h-5 text-leaf" />
    <span className="text-sm font-semibold text-text">Owner Payouts</span>
  </div>
  <span className="text-sub text-sm">→</span>
</Link>
```

Also add `IndianRupee` to the existing icon import line at the top of that file (it's already imported — verify).

- [ ] **Step 5: Verify + commit**

```bash
npx tsc --noEmit
npm run lint
git add src/app/(admin)/admin/approvals/ src/app/(admin)/admin/owners/ src/app/(admin)/admin/payouts/ src/app/(admin)/admin/page.tsx
git commit -m "feat(admin): approvals, owners, and payouts pages"
```

---

## Task 15: Add fleet assign-driver API + Supabase RLS

**Files:**
- Create: `src/app/api/fleet/assign-driver/route.ts`
- Create: `supabase/migrations/003_rls_fleet.sql`

- [ ] **Step 1: Assign driver endpoint**

```typescript
// src/app/api/fleet/assign-driver/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data } = await getAdminClient().auth.getUser(token || "");
  if (!data.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const owner = await prisma.owner.findUnique({ where: { user_id: data.user.id } });
  if (!owner || owner.status !== "ACTIVE") {
    return Response.json({ data: null, error: "Owner account required" }, { status: 403 });
  }

  const { vehicle_id, driver_profile_id } = await req.json().catch(() => ({}));
  if (!vehicle_id) return Response.json({ data: null, error: "vehicle_id required" }, { status: 400 });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicle_id, owner_id: owner.id } });
  if (!vehicle) return Response.json({ data: null, error: "Vehicle not found" }, { status: 404 });

  const updated = await prisma.vehicle.update({
    where: { id: vehicle_id },
    data:  { driver_id: driver_profile_id ?? null },
  });
  return Response.json({ data: updated, error: null });
}
```

- [ ] **Step 2: RLS migration for new tables**

```sql
-- supabase/migrations/003_rls_fleet.sql
-- RLS for Owner, Vehicle, Notification, OwnerPayout

ALTER TABLE "Owner"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vehicle"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OwnerPayout"  ENABLE ROW LEVEL SECURITY;

-- Owners see only their own record
CREATE POLICY "owner_own" ON "Owner"
  FOR ALL USING (auth.uid()::text = user_id);

-- Vehicles: owners see their own fleet
CREATE POLICY "vehicle_owner" ON "Vehicle"
  FOR ALL USING (
    owner_id IN (SELECT id FROM "Owner" WHERE user_id = auth.uid()::text)
  );

-- Notifications: users see their own
CREATE POLICY "notification_own" ON "Notification"
  FOR ALL USING (auth.uid()::text = user_id);

-- OwnerPayout: owners see their own payouts
CREATE POLICY "payout_owner" ON "OwnerPayout"
  FOR SELECT USING (
    owner_id IN (SELECT id FROM "Owner" WHERE user_id = auth.uid()::text)
  );
```

Apply this via Supabase SQL editor or MCP `execute_sql`.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/app/api/fleet/assign-driver/ supabase/migrations/003_rls_fleet.sql
git commit -m "feat(api): assign-driver endpoint and fleet RLS policies"
```

---

## Task 16: End-to-End Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test fleet registration flow**

Open `http://localhost:3000/fleet/register` (or `fleet.localhost:3000` if host file configured).

1. Enter phone → Get OTP → fill form → Submit → verify redirect to `/fleet/pending`
2. Check DB: `npx prisma studio` → DriverProfile or Owner record exists with `is_approved: false` / `status: PENDING`

- [ ] **Step 3: Test admin approvals**

Open `http://localhost:3000/admin/approvals` → login with admin token.
1. Pending applicant should appear
2. Click Approve → verify record updates in Prisma Studio
3. Verify `app_metadata.roles` set in Supabase dashboard → Authentication → Users

- [ ] **Step 4: Test fleet portal after approval**

Log in as approved fleet user → should reach `/fleet/today` (driver) or `/fleet/dashboard` (owner).
Verify bottom nav is correct for role.

- [ ] **Step 5: Test vehicle management**

As owner: `/fleet/vehicles` → Add Vehicle → `/fleet/vehicles/new` → fill form → Submit.
Verify vehicle appears in list. Toggle active/inactive.

- [ ] **Step 6: Commit smoke test results note**

```bash
git commit --allow-empty -m "test(fleet): manual smoke test passed — registration, approval, fleet portal"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Three portals: rider (unchanged), admin (extended), fleet (new)
- ✅ Hostname routing in proxy.ts
- ✅ Role system via Supabase app_metadata
- ✅ Owner, Vehicle, Notification, OwnerPayout models
- ✅ Driver registration + pending flow
- ✅ Admin approval flow with Supabase role assignment
- ✅ Owner mode: vehicles, drivers, earnings, payouts
- ✅ Driver mode: today, history, availability, notifications, profile
- ✅ In-app notifications
- ✅ RLS for new tables
- ✅ Cash-first: no payout tracking for cash bookings

**Known dependencies:**
- `/api/rides/driver` endpoint added in Task 12 — used by today/history pages
- `AdminGate` component assumed to exist at `@/components/admin/AdminGate` (already in codebase)
- `prisma` from `@/lib/prisma` assumed to export the Prisma client instance
- `getAdminClient` from `@/lib/supabase` confirmed to exist

**Out of scope (do not implement in this plan):**
- Razorpay (on hold until 2026-05-24)
- Custom domain setup
- Driver document image upload
- Owner earnings split tracking within platform
- Mobile push notifications
