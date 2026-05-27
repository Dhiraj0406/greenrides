# Driver Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete driver experience at `/drivers` — public landing, phone OTP onboarding, vehicle registration with Telegram linking, calendar availability, and a fairness-based dispatch cascade with Supabase Realtime accept/reject.

**Architecture:** Five phases — DB + lib foundation → onboarding pages → portal UI → dispatch system → admin enhancements. User-facing API routes use the Supabase admin client (`getAdminClient()`); admin routes use Prisma. Dispatch cascade runs via Vercel cron (every 60s); in-app notifications use Supabase Realtime subscriptions on the `DriverDispatch` table filtered by `driver_id`.

**Tech Stack:** Next.js 16, Prisma (schema management + `db push`), Supabase (runtime DB + Realtime + Auth), Telegram Bot API, Vercel Cron, Tailwind CSS, Zod, Lucide React, Sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-05-17-driver-flow-design.md`

---

## File Map

**Create:**
- `src/lib/telegram.ts` — send messages + generate/validate Telegram linking codes
- `src/app/api/telegram/webhook/route.ts` — handle `/start` from Telegram bot
- `src/app/api/drivers/register/route.ts` — POST: create DriverProfile
- `src/app/api/drivers/me/route.ts` — GET/PATCH: profile, availability, online toggle
- `src/app/api/requests/[id]/respond/route.ts` — PATCH: accept or reject a dispatch
- `src/app/api/cron/dispatch/route.ts` — GET: cascade expired dispatches
- `src/app/api/admin/dispatch/route.ts` — GET: list active dispatches
- `src/app/api/admin/dispatch/[id]/override/route.ts` — PATCH: skip/assign
- `src/app/drivers/layout.tsx` — auth + role guard for all /drivers/* routes
- `src/app/drivers/page.tsx` — public landing page
- `src/app/drivers/register/page.tsx` — registration form page
- `src/app/drivers/pending/page.tsx` — waiting for approval screen
- `src/app/drivers/dashboard/page.tsx` — tabbed portal
- `src/components/drivers/RegisterForm.tsx` — vehicle + Telegram code form
- `src/components/drivers/OnlineToggle.tsx` — online/offline toggle
- `src/components/drivers/AvailabilityCalendar.tsx` — calendar picker
- `src/components/drivers/DispatchCard.tsx` — Realtime accept/reject with countdown
- `vercel.json` — cron config

**Modify:**
- `prisma/schema.prisma` — add DriverDispatch, TelegramCode; extend DriverProfile + RideRequest
- `src/proxy.ts` — add `/drivers/dashboard`, `/drivers/register`, `/drivers/pending` to protected paths
- `src/app/api/requests/route.ts` — build dispatch queue after saving a RideRequest
- `src/app/api/admin/drivers/[id]/route.ts` — trigger Telegram + set `approved_at` on approval
- `src/app/(admin)/admin/drivers/page.tsx` — add online dot, availability count
- `src/app/(driver)/driver/dashboard/page.tsx` — redirect to `/drivers/dashboard`
- `src/app/(driver)/driver/post-ride/page.tsx` — redirect to `/drivers/dashboard`

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields and models to schema**

Open `prisma/schema.prisma` and make these four changes:

*Extend `DriverProfile`* — add after `created_at`:
```prisma
is_online        Boolean   @default(false)
telegram_chat_id String?
availability     Json?
approved_at      DateTime?
```

*Extend `RideRequest`* — add after `updated_at`:
```prisma
dispatched Boolean @default(false)
```

*Add new enum after existing enums:*
```prisma
enum DispatchStatus {
  WAITING
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}
```

*Add new models before the closing of the file:*
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
  driver  User        @relation("DriverDispatches", fields: [driver_id], references: [id])

  @@unique([request_id, order_index])
}

model TelegramCode {
  id         String   @id @default(uuid())
  code       String   @unique
  chat_id    String
  expires_at DateTime
  created_at DateTime @default(now())
}
```

Also add the reverse relation to `RideRequest`:
```prisma
dispatches DriverDispatch[]
```
And to `User`:
```prisma
driver_dispatches DriverDispatch[] @relation("DriverDispatches")
```

- [ ] **Step 2: Push schema to database**

```bash
cd green-rides
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/generated/
git commit -m "feat(db): add DriverDispatch, TelegramCode, extend DriverProfile + RideRequest"
```

---

## Task 2: Telegram Library

**Files:**
- Create: `src/lib/telegram.ts`

- [ ] **Step 1: Create the Telegram helper**

```typescript
// src/lib/telegram.ts
const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.error("[telegram] sendMessage failed", await res.text());
  }
}

export function generateTelegramCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
```

- [ ] **Step 2: Add `TELEGRAM_BOT_TOKEN` to local env**

Create or update `.env.local` (do not commit this file):
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

To get a token: message @BotFather on Telegram → `/newbot` → follow prompts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram.ts
git commit -m "feat(telegram): add sendMessage helper and code generator"
```

---

## Task 3: Telegram Webhook API

Handles the `/start` command from the Telegram bot. Generates a 6-digit linking code, stores it in `TelegramCode` with a 10-minute expiry, and replies with the code.

**Files:**
- Create: `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Create the webhook route**

```typescript
// src/app/api/telegram/webhook/route.ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage, generateTelegramCode } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  // Verify the request comes from Telegram (simple token check)
  const url = req.nextUrl;
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { message?: { chat?: { id?: number }; text?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("OK", { status: 200 });
  }

  const chatId = body.message?.chat?.id?.toString();
  const text   = body.message?.text ?? "";

  if (!chatId || !text.startsWith("/start")) {
    return new Response("OK", { status: 200 });
  }

  const db   = getAdminClient();
  const code = generateTelegramCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Delete any existing codes for this chat_id before inserting a fresh one
  await db.from("TelegramCode").delete().eq("chat_id", chatId);

  await db.from("TelegramCode").insert({
    id: crypto.randomUUID(),
    code,
    chat_id: chatId,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  await sendTelegramMessage(
    chatId,
    `🌿 <b>Green Rides</b>\n\nYour linking code is: <b>${code}</b>\n\nEnter this in the app to link your Telegram account. Valid for 10 minutes.`
  );

  return new Response("OK", { status: 200 });
}
```

- [ ] **Step 2: Add `TELEGRAM_WEBHOOK_SECRET` to env**

Generate any random string (e.g. `openssl rand -hex 16`) and add to `.env.local` and Vercel:
```
TELEGRAM_WEBHOOK_SECRET=your_random_secret_here
```

After deploying, register the webhook with Telegram once:
```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://green-rides.vercel.app/api/telegram/webhook?secret={SECRET}"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/telegram/webhook/route.ts
git commit -m "feat(telegram): add webhook handler for /start command"
```

---

## Task 4: Driver Registration API

**Files:**
- Create: `src/app/api/drivers/register/route.ts`

- [ ] **Step 1: Create the registration route**

```typescript
// src/app/api/drivers/register/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  vehicle_type:    z.enum(["sedan", "suv", "hatchback", "minivan"]),
  vehicle_model:   z.string().min(2).max(60),
  vehicle_number:  z.string().min(4).max(20).toUpperCase(),
  license_number:  z.string().min(4).max(30).toUpperCase(),
  telegram_code:   z.string().length(6),
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
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { vehicle_type, vehicle_model, vehicle_number, license_number, telegram_code } = parsed.data;
  const now = new Date().toISOString();

  // Validate Telegram code
  const { data: codeRow } = await db
    .from("TelegramCode")
    .select("chat_id, expires_at")
    .eq("code", telegram_code)
    .single();

  if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
    return Response.json({ error: "Invalid or expired Telegram code" }, { status: 400 });
  }

  // Check no existing profile
  const { data: existing } = await db
    .from("DriverProfile")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "Driver profile already exists" }, { status: 409 });
  }

  // Ensure user row exists in User table
  await db.from("User").upsert(
    { id: user.id, phone: user.phone ?? `unknown-${user.id.slice(0, 8)}`, role: "DRIVER", updated_at: now },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // Create DriverProfile
  const { data: profile, error: createErr } = await db
    .from("DriverProfile")
    .insert({
      id:               crypto.randomUUID(),
      user_id:          user.id,
      vehicle_type,
      vehicle_model,
      vehicle_number,
      license_number,
      telegram_chat_id: codeRow.chat_id,
      is_approved:      false,
      is_online:        false,
      avg_rating:       0,
      total_trips:      0,
      created_at:       now,
    })
    .select("id")
    .single();

  if (createErr || !profile) {
    console.error("[drivers/register POST]", createErr);
    return Response.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // Delete the used code
  await db.from("TelegramCode").delete().eq("code", telegram_code);

  return Response.json({ data: { id: profile.id }, error: null });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/drivers/register/route.ts
git commit -m "feat(api): add driver registration endpoint with Telegram code validation"
```

---

## Task 5: Driver Profile API

Handles GET (fetch own profile + active dispatch) and PATCH (update availability, toggle online status).

**Files:**
- Create: `src/app/api/drivers/me/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/drivers/me/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

async function getAuthedDriver(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data: { user } } = await db.auth.getUser(token);
  return user ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedDriver(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: profile } = await db
    .from("DriverProfile")
    .select("id, vehicle_type, vehicle_model, vehicle_number, license_number, is_approved, is_online, avg_rating, total_trips, availability, approved_at, telegram_chat_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return Response.json({ data: null, error: null });

  // Fetch active dispatch (PENDING status assigned to this driver)
  const { data: activeDispatch } = await db
    .from("DriverDispatch")
    .select("id, request_id, expires_at, dispatched_at")
    .eq("driver_id", user.id)
    .eq("status", "PENDING")
    .maybeSingle();

  let requestDetails = null;
  if (activeDispatch) {
    const { data: req_ } = await db
      .from("RideRequest")
      .select("id, from_city, to_city, fare_paise, travel_date, notes")
      .eq("id", activeDispatch.request_id)
      .single();
    requestDetails = req_;
  }

  return Response.json({
    data: {
      ...profile,
      active_dispatch: activeDispatch ? { ...activeDispatch, request: requestDetails } : null,
    },
    error: null,
  });
}

const patchSchema = z.object({
  is_online:    z.boolean().optional(),
  availability: z.record(z.string(), z.union([
    z.object({ start: z.string(), end: z.string() }),
    z.literal("rest"),
  ])).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthedDriver(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = getAdminClient();

  // If trying to go online, verify required days (next 7) are all filled
  if (parsed.data.is_online === true) {
    const { data: profile } = await db
      .from("DriverProfile")
      .select("availability, is_approved")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_approved) {
      return Response.json({ error: "Account not approved yet" }, { status: 403 });
    }

    const avail = (profile.availability as Record<string, unknown>) ?? {};
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      if (!avail[key]) {
        return Response.json(
          { error: `Fill availability for all 7 required days before going online (missing: ${key})` },
          { status: 400 }
        );
      }
    }
  }

  const { error } = await db
    .from("DriverProfile")
    .update({ ...parsed.data })
    .eq("user_id", user.id);

  if (error) {
    console.error("[drivers/me PATCH]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json({ data: { ok: true }, error: null });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/drivers/me/route.ts
git commit -m "feat(api): add driver profile GET/PATCH endpoint with online guard"
```

---

## Task 6: Public Landing Page + Drivers Layout

**Files:**
- Create: `src/app/drivers/layout.tsx`
- Create: `src/app/drivers/page.tsx`

- [ ] **Step 1: Create the layout with auth + role guard**

```typescript
// src/app/drivers/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DriversLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Public pages: /drivers itself — anyone can view
      if (pathname === "/drivers") {
        if (session) {
          // Check driver status and redirect appropriately
          const { data: profile } = await supabase
            .from("DriverProfile")
            .select("is_approved")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (!profile) {
            router.replace("/drivers/register");
            return;
          }
          if (!profile.is_approved) {
            router.replace("/drivers/pending");
            return;
          }
          router.replace("/drivers/dashboard");
          return;
        }
        setReady(true);
        return;
      }

      // Protected pages require a session
      if (!session) {
        router.replace(`/login?next=${pathname}`);
        return;
      }

      const { data: profile } = await supabase
        .from("DriverProfile")
        .select("is_approved")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (pathname === "/drivers/register") {
        if (profile) {
          router.replace(profile.is_approved ? "/drivers/dashboard" : "/drivers/pending");
          return;
        }
        setReady(true);
        return;
      }

      if (pathname === "/drivers/pending") {
        if (!profile) { router.replace("/drivers/register"); return; }
        if (profile.is_approved) { router.replace("/drivers/dashboard"); return; }
        setReady(true);
        return;
      }

      // /drivers/dashboard
      if (!profile) { router.replace("/drivers/register"); return; }
      if (!profile.is_approved) { router.replace("/drivers/pending"); return; }
      setReady(true);
    });
  }, [pathname, router]);

  if (!ready) return (
    <div className="green-container min-h-screen bg-cream flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-leaf border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return <>{children}</>;
}
```

- [ ] **Step 2: Create the public landing page**

```typescript
// src/app/drivers/page.tsx
import Link from "next/link";
import { Car, Clock, TrendingUp, Shield, Leaf, ChevronRight } from "lucide-react";

export default function DriversLandingPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      {/* Hero */}
      <div className="bg-forest px-6 pt-safe-top pb-12 text-center">
        <div className="pt-8 flex items-center justify-center gap-2 mb-6">
          <Leaf className="w-6 h-6 text-lime" />
          <span className="font-display text-2xl text-lime">Green Rides</span>
        </div>
        <h1 className="text-3xl font-display text-white mb-3 leading-tight">
          Drive with us.<br />Earn on your terms.
        </h1>
        <p className="text-lime/70 text-sm mb-8 max-w-xs mx-auto">
          Join Odisha's trusted cab network. Set your own schedule, choose your routes, get paid fairly.
        </p>
        <Link
          href="/login?next=/drivers"
          className="inline-flex items-center gap-2 bg-leaf text-white font-bold px-8 py-4 rounded-2xl text-base shadow-lg"
        >
          Become a Driver <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Benefits */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-display text-text mb-6 text-center">Why drive with Green?</h2>
        <div className="space-y-4">
          {[
            { icon: Clock, title: "Your schedule", desc: "Set availability day by day. Take rest days whenever you need." },
            { icon: TrendingUp, title: "Fair rides", desc: "Our algorithm ensures rides are distributed equally across all drivers." },
            { icon: Car, title: "Simple app", desc: "Accept ride requests in one tap. Get Telegram notifications instantly." },
            { icon: Shield, title: "Safe & trusted", desc: "Every driver is manually verified and approved by our team." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-border rounded-2xl p-4 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-pale flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-leaf" />
              </div>
              <div>
                <p className="font-semibold text-text text-sm">{title}</p>
                <p className="text-sub text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="px-6 pb-12">
        <h2 className="text-lg font-display text-text mb-6 text-center">How it works</h2>
        <div className="space-y-3">
          {[
            { n: "1", text: "Sign up with your phone number" },
            { n: "2", text: "Add your vehicle details and link Telegram" },
            { n: "3", text: "Wait for approval (usually within 24 hours)" },
            { n: "4", text: "Go online, set your schedule, start earning" },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-leaf text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                {n}
              </div>
              <p className="text-sm text-text">{text}</p>
            </div>
          ))}
        </div>
        <Link
          href="/login?next=/drivers"
          className="mt-8 w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold px-6 py-4 rounded-2xl text-base"
        >
          Get started <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `src/proxy.ts` to protect driver routes**

Add `/drivers/dashboard`, `/drivers/register`, `/drivers/pending` to the `PROTECTED` array and the matcher:

```typescript
// src/proxy.ts
import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/bookings",
  "/profile",
  "/driver/dashboard",
  "/driver/post-ride",
  "/drivers/dashboard",
  "/drivers/register",
  "/drivers/pending",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasCookie = [...req.cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!hasCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/bookings/:path*",
    "/profile/:path*",
    "/driver/:path*",
    "/drivers/dashboard/:path*",
    "/drivers/register/:path*",
    "/drivers/pending/:path*",
  ],
};
```

- [ ] **Step 4: Commit**

```bash
git add src/app/drivers/layout.tsx src/app/drivers/page.tsx src/proxy.ts
git commit -m "feat(drivers): add public landing page, layout guard, and proxy protection"
```

---

## Task 7: Registration + Pending Pages

**Files:**
- Create: `src/components/drivers/RegisterForm.tsx`
- Create: `src/app/drivers/register/page.tsx`
- Create: `src/app/drivers/pending/page.tsx`

- [ ] **Step 1: Create RegisterForm component**

```typescript
// src/components/drivers/RegisterForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ExternalLink, Loader2 } from "lucide-react";

const schema = z.object({
  vehicle_type:   z.enum(["sedan", "suv", "hatchback", "minivan"], { message: "Select a vehicle type" }),
  vehicle_model:  z.string().min(2, "Enter vehicle model"),
  vehicle_number: z.string().min(4, "Enter vehicle number"),
  license_number: z.string().min(4, "Enter licence number"),
  telegram_code:  z.string().length(6, "Code must be 6 digits"),
});

type FormData = z.infer<typeof schema>;

const BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "GreenRidesBot";

export function RegisterForm() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const inputClass =
    "w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-sub/60 outline-none focus:ring-2 ring-leaf/30";
  const labelClass = "block text-xs font-semibold text-sub mb-1.5 uppercase tracking-wide";
  const errorClass = "text-xs text-red-500 mt-1";

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      const res = await fetch("/api/drivers/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Registration failed"); return; }

      toast.success("Registration submitted! Waiting for approval.");
      router.push("/drivers/pending");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Telegram linking */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">Step 1 — Link Telegram</p>
        <p className="text-xs text-blue-700 mb-3">
          Open our Telegram bot, send <code>/start</code>, and copy the 6-digit code it gives you.
        </p>
        <a
          href={`https://t.me/${BOT_NAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          <ExternalLink className="w-4 h-4" /> Open @{BOT_NAME}
        </a>
      </div>

      <div>
        <label className={labelClass}>Telegram Code</label>
        <input
          {...register("telegram_code")}
          className={inputClass}
          placeholder="6-digit code from bot"
          maxLength={6}
        />
        {errors.telegram_code && <p className={errorClass}>{errors.telegram_code.message}</p>}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-4">Step 2 — Vehicle Details</p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Vehicle Type</label>
            <select {...register("vehicle_type")} className={inputClass}>
              <option value="">Select type…</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
              <option value="hatchback">Hatchback</option>
              <option value="minivan">Minivan</option>
            </select>
            {errors.vehicle_type && <p className={errorClass}>{errors.vehicle_type.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Vehicle Model</label>
            <input {...register("vehicle_model")} className={inputClass} placeholder="e.g. Maruti Swift" />
            {errors.vehicle_model && <p className={errorClass}>{errors.vehicle_model.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Vehicle Number</label>
            <input {...register("vehicle_number")} className={inputClass} placeholder="e.g. OD05AB1234" />
            {errors.vehicle_number && <p className={errorClass}>{errors.vehicle_number.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Driving Licence Number</label>
            <input {...register("license_number")} className={inputClass} placeholder="e.g. OD0520220001234" />
            {errors.license_number && <p className={errorClass}>{errors.license_number.message}</p>}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold py-4 rounded-2xl text-base disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Registration"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_TELEGRAM_BOT_NAME` to env**

In `.env.local` and Vercel dashboard:
```
NEXT_PUBLIC_TELEGRAM_BOT_NAME=GreenRidesBot
```

(Replace `GreenRidesBot` with the actual bot username from @BotFather.)

- [ ] **Step 3: Create register page**

```typescript
// src/app/drivers/register/page.tsx
import { ChevronLeft, Leaf } from "lucide-react";
import Link from "next/link";
import { RegisterForm } from "@/components/drivers/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="green-container min-h-screen bg-cream pb-10">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/drivers" className="w-8 h-8 rounded-full bg-forest-mid flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-lime" />
          </Link>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-lime" />
            <span className="font-display text-xl text-lime">Become a Driver</span>
          </div>
        </div>
      </header>
      <div className="px-4 mt-6">
        <p className="text-sm text-sub mb-6">
          Complete the steps below to join Green Rides as a driver. Your account will be reviewed within 24 hours.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create pending page**

```typescript
// src/app/drivers/pending/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PendingPage() {
  const router = useRouter();

  useEffect(() => {
    // Poll every 30s — redirect to dashboard once approved
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("DriverProfile")
        .select("is_approved")
        .eq("user_id", session.user.id)
        .single();
      if (data?.is_approved) router.replace("/drivers/dashboard");
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-pale flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-leaf" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Leaf className="w-4 h-4 text-leaf" />
        <span className="font-display text-xl text-text">Under Review</span>
      </div>
      <p className="text-sub text-sm max-w-xs mb-4">
        Your registration is being reviewed by our team. You'll receive a Telegram message once approved — usually within 24 hours.
      </p>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-leaf/40 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/drivers/RegisterForm.tsx src/app/drivers/register/page.tsx src/app/drivers/pending/page.tsx
git commit -m "feat(drivers): add registration form, register page, and pending page"
```

---

## Task 8: Availability Calendar Component

**Files:**
- Create: `src/components/drivers/AvailabilityCalendar.tsx`

- [ ] **Step 1: Create the calendar component**

```typescript
// src/components/drivers/AvailabilityCalendar.tsx
"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DayEntry = { start: string; end: string } | "rest";
type Availability = Record<string, DayEntry>;

function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getRequiredKeys(): string[] {
  const keys: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    keys.push(toDateKey(d));
  }
  return keys;
}

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);

interface Props {
  value: Availability;
  onChange: (next: Availability) => void;
}

export function AvailabilityCalendar({ value, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected]   = useState<string | null>(toDateKey(today));

  const requiredKeys = useMemo(getRequiredKeys, []);

  const unfilledRequired = requiredKeys.filter((k) => !value[k]);
  const selectedEntry    = selected ? value[selected] : undefined;

  // Calendar grid helpers
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey    = toDateKey(today);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function setDayEntry(key: string, entry: DayEntry) {
    onChange({ ...value, [key]: entry });
  }
  function clearDay(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="space-y-4">
      {unfilledRequired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-medium">
          ⚠️ {unfilledRequired.length} required day{unfilledRequired.length > 1 ? "s" : ""} not filled — go online is blocked until complete.
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1 text-sub hover:text-text">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm text-text">{monthNames[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="p-1 text-sub hover:text-text">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-[10px] font-bold text-sub py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(viewYear, viewMonth, i + 1);
          const key  = toDateKey(date);
          const isPast     = date < today;
          const isToday    = key === todayKey;
          const isRequired = requiredKeys.includes(key);
          const entry      = value[key];
          const isSelected = key === selected;

          const dayClass = cn(
            "aspect-square flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold cursor-pointer select-none border transition-all",
            isPast && "opacity-30 cursor-not-allowed border-transparent text-sub",
            !isPast && !entry && !isRequired && "bg-white border-border text-sub hover:border-leaf/40",
            !isPast && !entry && isRequired && "bg-white border-red-400 text-text shadow-[0_0_0_1.5px_#ef4444]",
            !isPast && entry === "rest" && "bg-amber-50 border-amber-400 text-amber-800",
            !isPast && entry && entry !== "rest" && "bg-green-50 border-green-400 text-green-800",
            isSelected && !isPast && "ring-2 ring-leaf ring-offset-1",
            isToday && !isPast && "outline outline-2 outline-lime outline-offset-1"
          );

          return (
            <div
              key={key}
              className={dayClass}
              onClick={() => !isPast && setSelected(key)}
            >
              {i + 1}
              {!isPast && entry && (
                <div className={cn("w-1 h-1 rounded-full mt-0.5", entry === "rest" ? "bg-amber-500" : "bg-green-500")} />
              )}
              {!isPast && !entry && isRequired && (
                <div className="w-1 h-1 rounded-full mt-0.5 bg-red-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-sub">
        {[
          { color: "bg-green-400", label: "Available" },
          { color: "bg-amber-400", label: "Rest day" },
          { color: "border border-red-400", label: "Required, unfilled" },
          { color: "bg-gray-200", label: "Optional" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm inline-block", color)} />{label}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && new Date(selected + "T00:00:00") >= today && (
        <div className="bg-white border border-leaf/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-text">
              {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </span>
            {requiredKeys.includes(selected) ? (
              <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">Required</span>
            ) : (
              <span className="text-[10px] bg-gray-50 text-sub border border-border px-2 py-0.5 rounded-full">Optional</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDayEntry(selected, { start: "08:00", end: "18:00" })}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                selectedEntry && selectedEntry !== "rest"
                  ? "bg-green-50 border-green-400 text-green-800"
                  : "bg-gray-50 border-border text-sub"
              )}
            >
              ✓ Available
            </button>
            <button
              onClick={() => setDayEntry(selected, "rest")}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                selectedEntry === "rest"
                  ? "bg-amber-50 border-amber-400 text-amber-800"
                  : "bg-gray-50 border-border text-sub"
              )}
            >
              ✕ Rest Day
            </button>
            {selectedEntry && (
              <button
                onClick={() => clearDay(selected)}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-border text-sub bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>

          {selectedEntry && selectedEntry !== "rest" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-sub mb-1">Start time</p>
                <select
                  value={selectedEntry.start}
                  onChange={(e) => setDayEntry(selected, { ...selectedEntry, start: e.target.value })}
                  className="w-full bg-gray-50 border border-border rounded-lg px-3 py-2 text-sm font-semibold text-text"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <span className="text-sub mt-4">—</span>
              <div className="flex-1">
                <p className="text-[10px] text-sub mb-1">End time</p>
                <select
                  value={selectedEntry.end}
                  onChange={(e) => setDayEntry(selected, { ...selectedEntry, end: e.target.value })}
                  className="w-full bg-gray-50 border border-border rounded-lg px-3 py-2 text-sm font-semibold text-text"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/drivers/AvailabilityCalendar.tsx
git commit -m "feat(drivers): add calendar availability component with required-days validation"
```

---

## Task 9: Online Toggle Component

**Files:**
- Create: `src/components/drivers/OnlineToggle.tsx`

- [ ] **Step 1: Create the toggle**

```typescript
// src/components/drivers/OnlineToggle.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Props {
  initialValue: boolean;
  onChanged: (isOnline: boolean) => void;
}

export function OnlineToggle({ initialValue, onChanged }: Props) {
  const [isOnline, setIsOnline] = useState(initialValue);
  const [loading, setLoading]   = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const next = !isOnline;
      const res  = await fetch("/api/drivers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_online: next }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not update status");
        return;
      }

      setIsOnline(next);
      onChanged(next);
      toast.success(next ? "You are now online" : "You are now offline");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all font-semibold text-sm",
        isOnline
          ? "bg-leaf/10 border-leaf text-leaf"
          : "bg-gray-50 border-border text-sub"
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span className={cn("w-3 h-3 rounded-full", isOnline ? "bg-leaf animate-pulse" : "bg-gray-400")} />
      )}
      {isOnline ? "Online — receiving requests" : "Offline — tap to go online"}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/drivers/OnlineToggle.tsx
git commit -m "feat(drivers): add online/offline toggle component"
```

---

## Task 10: DispatchCard with Supabase Realtime

Shows a live countdown when a ride request is dispatched to the driver. Subscribes to Supabase Realtime on `DriverDispatch`.

**Files:**
- Create: `src/components/drivers/DispatchCard.tsx`

- [ ] **Step 1: Create the dispatch card**

```typescript
// src/components/drivers/DispatchCard.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, Navigation } from "lucide-react";

interface DispatchRequest {
  id: string;          // DriverDispatch.id
  request_id: string;
  expires_at: string;
  request: {
    from_city:   string;
    to_city:     string;
    fare_paise:  number;
    travel_date: string;
    notes:       string | null;
  } | null;
}

interface Props {
  driverId: string;
  initial:  DispatchRequest | null;
}

export function DispatchCard({ driverId, initial }: Props) {
  const [dispatch, setDispatch] = useState<DispatchRequest | null>(initial);
  const [secondsLeft, setSeconds] = useState(0);
  const [responding, setResponding] = useState(false);

  // Recalculate seconds remaining
  useEffect(() => {
    if (!dispatch) return;
    const recalc = () => {
      const diff = Math.max(0, Math.round((new Date(dispatch.expires_at).getTime() - Date.now()) / 1000));
      setSeconds(diff);
      if (diff === 0) setDispatch(null);
    };
    recalc();
    const id = setInterval(recalc, 1000);
    return () => clearInterval(id);
  }, [dispatch]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`driver-dispatch-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "DriverDispatch", filter: `driver_id=eq.${driverId}` },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === "PENDING") {
            // Fetch the associated request details
            const { data: req } = await supabase
              .from("RideRequest")
              .select("from_city, to_city, fare_paise, travel_date, notes")
              .eq("id", row.request_id as string)
              .single();
            setDispatch({
              id:         row.id as string,
              request_id: row.request_id as string,
              expires_at: row.expires_at as string,
              request:    req,
            });
          } else if (["EXPIRED", "ACCEPTED", "REJECTED"].includes(row.status as string)) {
            setDispatch(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const respond = useCallback(async (action: "accept" | "reject") => {
    if (!dispatch) return;
    setResponding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const eta_min = action === "accept"
        ? parseInt(prompt("Enter your ETA in minutes (e.g. 15):") || "30", 10)
        : undefined;

      const res = await fetch(`/api/requests/${dispatch.request_id}/respond`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, dispatch_id: dispatch.id, eta_min }),
      });

      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to respond"); return; }

      toast.success(action === "accept" ? "Ride accepted! Rider has been notified." : "Ride rejected.");
      setDispatch(null);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResponding(false);
    }
  }, [dispatch]);

  if (!dispatch || !dispatch.request) return null;

  const { request } = dispatch;
  const pct = Math.round((secondsLeft / 60) * 100);

  return (
    <div className="bg-white border-2 border-amber-400 rounded-2xl p-4 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-text">New Ride Request</span>
        </div>
        {/* Circular countdown */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#fde68a" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke={secondsLeft <= 15 ? "#ef4444" : "#f59e0b"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <span className={cn(
            "absolute inset-0 flex items-center justify-center text-xs font-bold",
            secondsLeft <= 15 ? "text-red-500" : "text-amber-600"
          )}>
            {secondsLeft}s
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="font-bold text-text text-base">
          {request.from_city} → {request.to_city}
        </p>
        <p className="text-sm text-sub mt-0.5">
          ₹{Math.round(request.fare_paise / 100)} ·{" "}
          {new Date(request.travel_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
        {request.notes && (
          <p className="text-xs text-sub mt-1 italic">{request.notes}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => respond("reject")}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-500 border border-red-200 font-bold py-3 rounded-xl text-sm"
        >
          {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "✕ Reject"}
        </button>
        <button
          onClick={() => respond("accept")}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1.5 bg-leaf text-white font-bold py-3 rounded-xl text-sm"
        >
          {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "✓ Accept"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/drivers/DispatchCard.tsx
git commit -m "feat(drivers): add real-time dispatch card with Supabase Realtime subscription"
```

---

## Task 11: Driver Dashboard Page

Tabbed portal with Home / Requests / Schedule / Rides.

**Files:**
- Create: `src/app/drivers/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

```typescript
// src/app/drivers/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Leaf, Loader2, Plus, Star, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { OnlineToggle } from "@/components/drivers/OnlineToggle";
import { DispatchCard } from "@/components/drivers/DispatchCard";
import { AvailabilityCalendar } from "@/components/drivers/AvailabilityCalendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "home" | "requests" | "schedule" | "rides";

interface DriverData {
  id:              string;
  user_id:         string;
  is_online:       boolean;
  is_approved:     boolean;
  avg_rating:      number;
  total_trips:     number;
  availability:    Record<string, unknown>;
  active_dispatch: null | {
    id:         string;
    request_id: string;
    expires_at: string;
    request:    { from_city: string; to_city: string; fare_paise: number; travel_date: string; notes: string | null } | null;
  };
}

export default function DriverDashboardPage() {
  const [tab, setTab]         = useState<Tab>("home");
  const [driver, setDriver]   = useState<DriverData | null>(null);
  const [userId, setUserId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);
  const [localAvail, setLocalAvail]   = useState<Record<string, unknown>>({});
  const [dispatches, setDispatches]   = useState<unknown[]>([]);
  const [rides, setRides]             = useState<unknown[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const res  = await fetch("/api/drivers/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) {
        setDriver(json.data);
        setLocalAvail(json.data.availability ?? {});
      }
      setLoading(false);
    })();
  }, []);

  // Load requests tab data
  useEffect(() => {
    if (tab !== "requests" || !userId) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("DriverDispatch")
        .select("id, status, dispatched_at, responded_at, request:RideRequest(from_city, to_city, fare_paise, travel_date)")
        .eq("driver_id", session.user.id)
        .neq("status", "WAITING")
        .order("created_at", { ascending: false })
        .limit(30);
      setDispatches(data ?? []);
    });
  }, [tab, userId]);

  // Load rides tab data
  useEffect(() => {
    if (tab !== "rides" || !userId) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("Ride")
        .select("id, from_city, to_city, departure_time, fare_paise, status, available_seats, total_seats")
        .eq("driver_id", session.user.id)
        .order("departure_time", { ascending: false })
        .limit(20);
      setRides(data ?? []);
    });
  }, [tab, userId]);

  async function saveAvailability() {
    setSavingAvail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/drivers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ availability: localAvail }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Save failed"); return; }
      setDriver(d => d ? { ...d, availability: localAvail } : d);
      toast.success("Availability saved");
    } finally {
      setSavingAvail(false);
    }
  }

  if (loading) {
    return (
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "home",     label: "Home"     },
    { key: "requests", label: "Requests" },
    { key: "schedule", label: "Schedule" },
    { key: "rides",    label: "Rides"    },
  ];

  return (
    <div className="green-container min-h-screen bg-cream pb-8">
      {/* Header with tabs */}
      <header className="bg-forest px-4 pt-safe-top pb-0 sticky top-0 z-20">
        <div className="pt-4 flex items-center gap-2 mb-3">
          <Leaf className="w-5 h-5 text-lime" />
          <span className="font-display text-xl text-lime flex-1">Driver Portal</span>
          {driver && (
            <div className="flex items-center gap-1.5 text-xs text-lime/60 font-mono-green">
              <Star className="w-3 h-3 fill-gold text-gold" />
              {driver.avg_rating.toFixed(1)} · {driver.total_trips} trips
            </div>
          )}
        </div>
        <div className="flex gap-1 pb-3">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 py-2 text-[11px] font-bold rounded-t-lg transition-all",
                tab === t.key
                  ? "bg-cream text-forest"
                  : "text-lime/60 hover:text-lime"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-5 space-y-4">
        {/* HOME TAB */}
        {tab === "home" && driver && (
          <>
            <OnlineToggle
              initialValue={driver.is_online}
              onChanged={(v) => setDriver(d => d ? { ...d, is_online: v } : d)}
            />
            {driver.active_dispatch && (
              <DispatchCard
                driverId={userId!}
                initial={driver.active_dispatch as never}
              />
            )}
            {!driver.active_dispatch && (
              <div className="bg-white border border-border rounded-2xl p-6 text-center text-sm text-sub">
                {driver.is_online
                  ? "You're online. Waiting for ride requests…"
                  : "Go online to start receiving ride requests."}
              </div>
            )}
          </>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <>
            <h2 className="text-sm font-semibold text-text">Dispatch History</h2>
            {(dispatches as Array<Record<string, unknown>>).length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-sub">
                No dispatch history yet.
              </div>
            ) : (
              (dispatches as Array<Record<string, unknown>>).map((d: Record<string, unknown>) => {
                const req = d.request as Record<string, unknown> | null;
                const statusColors: Record<string, string> = {
                  ACCEPTED: "bg-green-50 text-green-700",
                  REJECTED: "bg-red-50 text-red-600",
                  EXPIRED:  "bg-gray-50 text-sub",
                };
                return (
                  <div key={d.id as string} className="bg-white border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-text">
                        {req ? `${req.from_city} → ${req.to_city}` : "—"}
                      </span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", statusColors[d.status as string] ?? "bg-gray-50 text-sub")}>
                        {d.status as string}
                      </span>
                    </div>
                    {req && (
                      <p className="text-xs text-sub">
                        ₹{Math.round((req.fare_paise as number) / 100)} ·{" "}
                        {new Date(req.travel_date as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* SCHEDULE TAB */}
        {tab === "schedule" && (
          <>
            <AvailabilityCalendar
              value={localAvail as Record<string, { start: string; end: string } | "rest">}
              onChange={setLocalAvail as (v: Record<string, unknown>) => void}
            />
            <button
              onClick={saveAvailability}
              disabled={savingAvail}
              className="w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
            >
              {savingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Availability"}
            </button>
          </>
        )}

        {/* RIDES TAB */}
        {tab === "rides" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Your Rides</h2>
              <a
                href="/drivers/post-ride"
                className="flex items-center gap-1 bg-leaf text-white text-xs font-bold px-3 py-2 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" /> Post Ride
              </a>
            </div>
            {(rides as Array<Record<string, unknown>>).length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-sub">
                No rides posted yet.
              </div>
            ) : (
              (rides as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => (
                <div key={r.id as string} className="bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-text">
                      <span>{r.from_city as string}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-sub" />
                      <span>{r.to_city as string}</span>
                    </div>
                    <span className="text-xs text-sub">{r.status as string}</span>
                  </div>
                  <p className="text-xs text-sub font-mono-green">
                    {new Date(r.departure_time as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                    ₹{Math.round((r.fare_paise as number) / 100)} ·{" "}
                    {r.available_seats as number}/{r.total_seats as number} seats
                  </p>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/drivers/dashboard/page.tsx
git commit -m "feat(drivers): add tabbed driver portal dashboard"
```

---

## Task 12: Accept/Reject API

**Files:**
- Create: `src/app/api/requests/[id]/respond/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/requests/[id]/respond/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

const schema = z.object({
  action:      z.enum(["accept", "reject"]),
  dispatch_id: z.string().uuid(),
  eta_min:     z.number().int().min(1).max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { action, dispatch_id, eta_min } = parsed.data;
  const now = new Date().toISOString();

  // Verify this dispatch belongs to the authed driver and is currently PENDING
  const { data: dispatch } = await db
    .from("DriverDispatch")
    .select("id, request_id, driver_id, status")
    .eq("id", dispatch_id)
    .eq("driver_id", user.id)
    .eq("request_id", requestId)
    .single();

  if (!dispatch || dispatch.status !== "PENDING") {
    return Response.json({ error: "Dispatch not found or already resolved" }, { status: 404 });
  }

  if (action === "accept") {
    // Mark this dispatch ACCEPTED
    await db.from("DriverDispatch").update({ status: "ACCEPTED", responded_at: now }).eq("id", dispatch_id);

    // Mark all other dispatches for this request as SKIPPED
    await db
      .from("DriverDispatch")
      .update({ status: "EXPIRED" })
      .eq("request_id", requestId)
      .neq("id", dispatch_id);

    // Get driver profile for name and telegram
    const { data: driverProfile } = await db
      .from("DriverProfile")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .single();

    const { data: userRow } = await db
      .from("User")
      .select("name, phone")
      .eq("id", user.id)
      .single();

    // Update the RideRequest with driver info
    await db
      .from("RideRequest")
      .update({
        status:       "CONFIRMED",
        driver_name:  userRow?.name ?? "Driver",
        driver_phone: userRow?.phone ?? "",
        eta_min:      eta_min ?? null,
        updated_at:   now,
      })
      .eq("id", requestId);

    // Notify the rider via Telegram
    const { data: rideRequest } = await db
      .from("RideRequest")
      .select("rider_id, from_city, to_city")
      .eq("id", requestId)
      .single();

    if (rideRequest) {
      const { data: riderProfile } = await db
        .from("DriverProfile")
        .select("telegram_chat_id")
        .eq("user_id", rideRequest.rider_id)
        .maybeSingle();

      // Try to notify rider via Telegram (rider may not have telegram linked)
      // Also notify rider via the existing Interakt/notifications system if available
      if (riderProfile?.telegram_chat_id) {
        await sendTelegramMessage(
          riderProfile.telegram_chat_id,
          `✅ <b>Driver found!</b>\n\n${userRow?.name ?? "Driver"} · ${userRow?.phone ?? ""}\nETA: ${eta_min ? `${eta_min} mins` : "Will contact you"}\n\nRoute: ${rideRequest.from_city} → ${rideRequest.to_city}`
        );
      }
    }

    return Response.json({ data: { ok: true, action: "accepted" }, error: null });
  }

  // Reject: mark REJECTED, immediately activate next WAITING dispatch
  await db.from("DriverDispatch").update({ status: "REJECTED", responded_at: now }).eq("id", dispatch_id);

  const { data: currentDispatch } = await db
    .from("DriverDispatch")
    .select("order_index")
    .eq("id", dispatch_id)
    .single();

  const { data: nextDispatch } = await db
    .from("DriverDispatch")
    .select("id, driver_id")
    .eq("request_id", requestId)
    .eq("status", "WAITING")
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextDispatch) {
    const nextExpiry = new Date(Date.now() + 60_000).toISOString();
    await db
      .from("DriverDispatch")
      .update({ status: "PENDING", dispatched_at: now, expires_at: nextExpiry })
      .eq("id", nextDispatch.id);

    // Notify next driver
    const { data: nextProfile } = await db
      .from("DriverProfile")
      .select("telegram_chat_id")
      .eq("user_id", nextDispatch.driver_id)
      .single();

    const { data: request } = await db
      .from("RideRequest")
      .select("from_city, to_city, fare_paise")
      .eq("id", requestId)
      .single();

    if (nextProfile?.telegram_chat_id && request) {
      await sendTelegramMessage(
        nextProfile.telegram_chat_id,
        `🚗 <b>New ride request</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`
      );
    }
  } else {
    // No more drivers — cancel the request
    await db.from("RideRequest").update({ status: "CANCELLED", updated_at: now }).eq("id", requestId);

    const { data: rideRequest } = await db
      .from("RideRequest")
      .select("rider_id")
      .eq("id", requestId)
      .single();

    if (rideRequest) {
      const { data: riderProfile } = await db
        .from("DriverProfile")
        .select("telegram_chat_id")
        .eq("user_id", rideRequest.rider_id)
        .maybeSingle();
      if (riderProfile?.telegram_chat_id) {
        await sendTelegramMessage(
          riderProfile.telegram_chat_id,
          `😔 No drivers available right now. We'll notify you when one is free.`
        );
      }
    }
  }

  return Response.json({ data: { ok: true, action: "rejected" }, error: null });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/requests/[id]/respond/route.ts
git commit -m "feat(api): add driver accept/reject endpoint with immediate cascade on reject"
```

---

## Task 13: Dispatch Queue Creation

Modify `POST /api/requests` to build the dispatch queue immediately after saving a new ride request.

**Files:**
- Modify: `src/app/api/requests/route.ts`

- [ ] **Step 1: Read the current file**

Open `src/app/api/requests/route.ts` and locate the section after the request is inserted (after `if (createErr || !request)`). Add a call to `buildDispatchQueue` immediately after returning success. Replace the final `return Response.json(...)` with:

```typescript
// After the successful insert, before the final return, add:
// Fire dispatch queue in background (don't block the response)
buildDispatchQueue(request.id, parsed.data.travel_date, db).catch((e) =>
  console.error("[requests POST] dispatch queue failed", e)
);

return Response.json({ data: { id: request.id, status: request.status }, error: null });
```

Then add the `buildDispatchQueue` function at the bottom of the file (before the closing, after all the route exports):

```typescript
// src/app/api/requests/route.ts — append this function at the bottom of the file
import { sendTelegramMessage } from "@/lib/telegram";
import type { SupabaseClient } from "@supabase/supabase-js";

async function buildDispatchQueue(
  requestId: string,
  travelDate: string,   // "2026-05-20"
  db: SupabaseClient,
): Promise<void> {
  const { data: rideRequest } = await db
    .from("RideRequest")
    .select("from_city, to_city, fare_paise")
    .eq("id", requestId)
    .single();

  if (!rideRequest) return;

  // Get all approved, online drivers
  const { data: profiles } = await db
    .from("DriverProfile")
    .select("id, user_id, total_trips, approved_at, availability, telegram_chat_id")
    .eq("is_approved", true)
    .eq("is_online", true);

  if (!profiles || profiles.length === 0) return;

  // Filter: driver must have availability for the travel date and it must not be "rest"
  const eligible = profiles.filter((p) => {
    const avail = (p.availability as Record<string, unknown> | null) ?? {};
    const day   = avail[travelDate];
    return day && day !== "rest";
  });

  if (eligible.length === 0) return;

  // Sort: fewest total_trips first, then earliest approved_at
  eligible.sort((a, b) => {
    if (a.total_trips !== b.total_trips) return a.total_trips - b.total_trips;
    return new Date(a.approved_at ?? 0).getTime() - new Date(b.approved_at ?? 0).getTime();
  });

  const now      = new Date();
  const expiry   = new Date(now.getTime() + 60_000).toISOString();

  const dispatches = eligible.map((p, i) => ({
    id:            crypto.randomUUID(),
    request_id:    requestId,
    driver_id:     p.user_id,
    order_index:   i + 1,
    status:        i === 0 ? "PENDING" : "WAITING",
    dispatched_at: i === 0 ? now.toISOString() : null,
    expires_at:    i === 0 ? expiry : null,
    created_at:    now.toISOString(),
  }));

  await db.from("DriverDispatch").insert(dispatches);
  await db.from("RideRequest").update({ dispatched: true }).eq("id", requestId);

  // Notify first driver via Telegram
  const firstDriver = eligible[0];
  if (firstDriver.telegram_chat_id) {
    await sendTelegramMessage(
      firstDriver.telegram_chat_id,
      `🚗 <b>New ride request</b>\n\n${rideRequest.from_city} → ${rideRequest.to_city} · ₹${Math.round(rideRequest.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/requests/route.ts
git commit -m "feat(dispatch): build driver dispatch queue on new ride request"
```

---

## Task 14: Dispatch Cron Job

**Files:**
- Create: `src/app/api/cron/dispatch/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create the cron route**

```typescript
// src/app/api/cron/dispatch/route.ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Protect: Vercel sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const db  = getAdminClient();
  const now = new Date().toISOString();

  // 1. Clean up expired TelegramCodes
  await db.from("TelegramCode").delete().lt("expires_at", now);

  // 2. Find PENDING dispatches that have expired
  const { data: expired } = await db
    .from("DriverDispatch")
    .select("id, request_id, order_index")
    .eq("status", "PENDING")
    .lt("expires_at", now);

  if (!expired || expired.length === 0) {
    return Response.json({ ok: true, cascaded: 0 });
  }

  let cascaded = 0;

  for (const dispatch of expired) {
    // Mark as EXPIRED
    await db.from("DriverDispatch").update({ status: "EXPIRED" }).eq("id", dispatch.id);

    // Find the next WAITING driver for this request
    const { data: next } = await db
      .from("DriverDispatch")
      .select("id, driver_id")
      .eq("request_id", dispatch.request_id)
      .eq("status", "WAITING")
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      const expiry = new Date(Date.now() + 60_000).toISOString();
      await db
        .from("DriverDispatch")
        .update({ status: "PENDING", dispatched_at: now, expires_at: expiry })
        .eq("id", next.id);

      // Get the driver's Telegram chat ID and notify
      const { data: profile } = await db
        .from("DriverProfile")
        .select("telegram_chat_id")
        .eq("user_id", next.driver_id)
        .single();

      const { data: request } = await db
        .from("RideRequest")
        .select("from_city, to_city, fare_paise")
        .eq("id", dispatch.request_id)
        .single();

      if (profile?.telegram_chat_id && request) {
        await sendTelegramMessage(
          profile.telegram_chat_id,
          `🚗 <b>New ride request</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`
        );
      }

      cascaded++;
    } else {
      // No more drivers — cancel the request
      await db
        .from("RideRequest")
        .update({ status: "CANCELLED", updated_at: now })
        .eq("id", dispatch.request_id);

      // Notify rider
      const { data: request } = await db
        .from("RideRequest")
        .select("rider_id")
        .eq("id", dispatch.request_id)
        .single();

      if (request) {
        const { data: riderProfile } = await db
          .from("DriverProfile")
          .select("telegram_chat_id")
          .eq("user_id", request.rider_id)
          .maybeSingle();
        if (riderProfile?.telegram_chat_id) {
          await sendTelegramMessage(
            riderProfile.telegram_chat_id,
            `😔 No drivers available for your request right now. We'll try again when a driver comes online.`
          );
        }
      }
    }
  }

  return Response.json({ ok: true, cascaded });
}
```

- [ ] **Step 2: Create vercel.json**

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

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/dispatch/route.ts vercel.json
git commit -m "feat(cron): add dispatch cascade cron job and vercel.json config"
```

---

## Task 15: Admin Dispatch Page

**Files:**
- Create: `src/app/api/admin/dispatch/route.ts`
- Create: `src/app/api/admin/dispatch/[id]/override/route.ts`
- Create: `src/app/(admin)/admin/drivers/dispatch/page.tsx`

- [ ] **Step 1: Create admin dispatch API — list active**

```typescript
// src/app/api/admin/dispatch/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dispatches = await (prisma as any).driverDispatch.findMany({
      where: { status: "PENDING" },
      include: {
        request: { select: { from_city: true, to_city: true, fare_paise: true, travel_date: true, status: true } },
        driver:  { select: { name: true, phone: true } },
      },
      orderBy: { dispatched_at: "asc" },
    });
    return Response.json({ data: dispatches, error: null });
  } catch (err) {
    console.error("[admin/dispatch GET]", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create admin override API**

```typescript
// src/app/api/admin/dispatch/[id]/override/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const schema = z.union([
  z.object({ action: z.literal("skip") }),
  z.object({ action: z.literal("assign"), driver_id: z.string().uuid() }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body    = await req.json();
  const parsed  = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const db  = getAdminClient();
  const now = new Date().toISOString();

  if (parsed.data.action === "skip") {
    // Mark current PENDING dispatch as EXPIRED, activate next WAITING one
    const dispatch = await (prisma as any).driverDispatch.findUnique({
      where: { id },
      select: { request_id: true, order_index: true },
    });
    if (!dispatch) return Response.json({ error: "Not found" }, { status: 404 });

    await db.from("DriverDispatch").update({ status: "EXPIRED" }).eq("id", id);

    const { data: next } = await db
      .from("DriverDispatch")
      .select("id, driver_id")
      .eq("request_id", dispatch.request_id)
      .eq("status", "WAITING")
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      const expiry = new Date(Date.now() + 60_000).toISOString();
      await db.from("DriverDispatch").update({ status: "PENDING", dispatched_at: now, expires_at: expiry }).eq("id", next.id);

      const { data: profile } = await db.from("DriverProfile").select("telegram_chat_id").eq("user_id", next.driver_id).single();
      const { data: request } = await db.from("RideRequest").select("from_city, to_city, fare_paise").eq("id", dispatch.request_id).single();
      if (profile?.telegram_chat_id && request) {
        await sendTelegramMessage(profile.telegram_chat_id, `🚗 <b>New ride request</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond. Open the app now.`);
      }
    }
    return Response.json({ data: { ok: true }, error: null });
  }

  // Manual assign: expire all pending/waiting dispatches, create new PENDING for target driver
  const dispatch = await (prisma as any).driverDispatch.findUnique({ where: { id }, select: { request_id: true } });
  if (!dispatch) return Response.json({ error: "Not found" }, { status: 404 });

  await db.from("DriverDispatch").update({ status: "EXPIRED" }).eq("request_id", dispatch.request_id).in("status", ["PENDING", "WAITING"]);

  const expiry = new Date(Date.now() + 60_000).toISOString();
  await db.from("DriverDispatch").insert({
    id:            crypto.randomUUID(),
    request_id:    dispatch.request_id,
    driver_id:     parsed.data.driver_id,
    order_index:   999,
    status:        "PENDING",
    dispatched_at: now,
    expires_at:    expiry,
    created_at:    now,
  });

  const { data: profile } = await db.from("DriverProfile").select("telegram_chat_id").eq("user_id", parsed.data.driver_id).single();
  const { data: request } = await db.from("RideRequest").select("from_city, to_city, fare_paise").eq("id", dispatch.request_id).single();
  if (profile?.telegram_chat_id && request) {
    await sendTelegramMessage(profile.telegram_chat_id, `🚗 <b>Admin assigned ride</b>\n\n${request.from_city} → ${request.to_city} · ₹${Math.round(request.fare_paise / 100)}\n\nYou have 60 seconds to respond.`);
  }

  return Response.json({ data: { ok: true }, error: null });
}
```

- [ ] **Step 3: Create admin dispatch page**

```typescript
// src/app/(admin)/admin/drivers/dispatch/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, SkipForward } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";

interface Dispatch {
  id:         string;
  expires_at: string;
  driver:     { name: string | null; phone: string };
  request:    { from_city: string; to_city: string; fare_paise: number; travel_date: string };
}

function DispatchContent({ token }: { token: string }) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = () => {
    fetch("/api/admin/dispatch", { headers: { "x-admin-token": token } })
      .then(r => r.json())
      .then(j => setDispatches(j.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [token]);

  async function skip(id: string) {
    await fetch(`/api/admin/dispatch/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ action: "skip" }),
    });
    load();
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center gap-3">
          <Link href="/admin/drivers" className="text-lime/70 hover:text-lime"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display text-xl text-white">Live Dispatch</h1>
        </div>
      </header>
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>
        ) : dispatches.length === 0 ? (
          <div className="text-center py-16 text-sub text-sm">No active dispatches</div>
        ) : dispatches.map((d) => {
          const secsLeft = Math.max(0, Math.round((new Date(d.expires_at).getTime() - Date.now()) / 1000));
          return (
            <div key={d.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-text">{d.request.from_city} → {d.request.to_city}</p>
                  <p className="text-xs text-sub">₹{Math.round(d.request.fare_paise / 100)} · {new Date(d.request.travel_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </div>
                <span className={cn("text-sm font-bold font-mono-green", secsLeft <= 15 ? "text-red-500" : "text-amber-600")}>
                  {secsLeft}s
                </span>
              </div>
              <p className="text-sm text-sub mb-3">
                → {d.driver.name ?? "—"} · {d.driver.phone}
              </p>
              <button
                onClick={() => skip(d.id)}
                className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip to next driver
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDispatchPage() {
  return <AdminGate>{(token) => <DispatchContent token={token} />}</AdminGate>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/dispatch/ src/app/(admin)/admin/drivers/dispatch/
git commit -m "feat(admin): add live dispatch monitoring page with skip override"
```

---

## Task 16: Admin Driver Page Enhancements

Add online indicator, availability count, Telegram trigger on approval.

**Files:**
- Modify: `src/app/api/admin/drivers/[id]/route.ts`
- Modify: `src/app/(admin)/admin/drivers/page.tsx`

- [ ] **Step 1: Update admin drivers PATCH to trigger Telegram and set approved_at**

Replace the contents of `src/app/api/admin/drivers/[id]/route.ts`:

```typescript
// src/app/api/admin/drivers/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const patchSchema = z.object({ is_approved: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json();
  const input  = patchSchema.parse(body);

  const updated = await (prisma as any).driverProfile.update({
    where: { id },
    data:  {
      is_approved: input.is_approved,
      approved_at: input.is_approved ? new Date() : null,
    },
    include: { user: { select: { name: true } } },
  });

  // Send Telegram notification when approving
  if (input.is_approved && updated.telegram_chat_id) {
    await sendTelegramMessage(
      updated.telegram_chat_id,
      `✅ <b>You're approved on Green Rides!</b>\n\nWelcome, ${updated.user?.name ?? "Driver"}! Open the app to set your schedule and go online.\n\nhttps://green-rides.vercel.app/drivers/dashboard`
    );
  }

  return Response.json({ data: updated, error: null });
}
```

- [ ] **Step 2: Add online indicator and dispatch link to admin drivers page**

In `src/app/(admin)/admin/drivers/page.tsx`, find the driver card rendering section. Add an online dot next to the driver name and a "Dispatch Log" link:

After the driver name `<p className="font-semibold text-text">{driver.user.name ?? "—"}</p>`, add:
```typescript
<div className="flex items-center gap-2">
  <p className="font-semibold text-text">{driver.user.name ?? "—"}</p>
  <span className={cn(
    "w-2 h-2 rounded-full flex-shrink-0",
    (driver as any).is_online ? "bg-leaf animate-pulse" : "bg-gray-300"
  )} title={(driver as any).is_online ? "Online" : "Offline"} />
</div>
```

At the bottom of the driver card actions row, add a link to the dispatch page:
```typescript
<Link
  href="/admin/drivers/dispatch"
  className="text-xs text-leaf font-semibold mt-2 inline-block"
>
  View live dispatch →
</Link>
```

Also update the `Driver` interface to include `is_online`:
```typescript
interface Driver {
  // ... existing fields ...
  is_online: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/drivers/[id]/route.ts src/app/(admin)/admin/drivers/page.tsx
git commit -m "feat(admin): add Telegram approval notification, online indicator, dispatch link"
```

---

## Task 17: Redirect Old Driver Routes

**Files:**
- Modify: `src/app/(driver)/driver/dashboard/page.tsx`
- Modify: `src/app/(driver)/driver/post-ride/page.tsx`

- [ ] **Step 1: Replace driver dashboard with redirect**

Replace the entire contents of `src/app/(driver)/driver/dashboard/page.tsx`:

```typescript
// src/app/(driver)/driver/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function OldDriverDashboard() {
  redirect("/drivers/dashboard");
}
```

- [ ] **Step 2: Replace post-ride page with redirect**

Replace the entire contents of `src/app/(driver)/driver/post-ride/page.tsx`:

```typescript
// src/app/(driver)/driver/post-ride/page.tsx
import { redirect } from "next/navigation";

export default function OldPostRide() {
  redirect("/drivers/dashboard");
}
```

- [ ] **Step 3: Add post-ride page to new portal**

Create `src/app/drivers/post-ride/page.tsx` so drivers can still post rides:

```typescript
// src/app/drivers/post-ride/page.tsx
import { ChevronLeft, Leaf } from "lucide-react";
import Link from "next/link";
import { RideForm } from "@/components/driver/RideForm";

export default function PostRidePage() {
  return (
    <div className="green-container min-h-screen bg-cream pb-10">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/drivers/dashboard" className="w-8 h-8 rounded-full bg-forest-mid flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-lime" />
          </Link>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-lime" />
            <span className="font-display text-xl text-lime">Post a Ride</span>
          </div>
        </div>
      </header>
      <div className="px-4 mt-6">
        <p className="text-sm text-sub mb-6">Fill in your route details. Riders in Odisha will see your listing.</p>
        <RideForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(driver)/driver/dashboard/page.tsx src/app/(driver)/driver/post-ride/page.tsx src/app/drivers/post-ride/page.tsx
git commit -m "feat(drivers): redirect old /driver/* routes to /drivers, add post-ride under new portal"
```

---

## Task 18: Environment Variables + Telegram Webhook Registration

- [ ] **Step 1: Add all new env vars to Vercel**

Run each of these, selecting "Production" environment:

```bash
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_TELEGRAM_BOT_NAME production
```

- [ ] **Step 2: Deploy to production**

```bash
vercel --prod
```

- [ ] **Step 3: Register Telegram webhook**

After deploy succeeds, run once:

```bash
curl "https://api.telegram.org/bot{YOUR_TELEGRAM_BOT_TOKEN}/setWebhook?url=https://green-rides.vercel.app/api/telegram/webhook?secret={YOUR_TELEGRAM_WEBHOOK_SECRET}"
```

Expected response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

- [ ] **Step 4: Verify cron is registered**

In Vercel dashboard → Project → Settings → Cron Jobs — confirm `* * * * *` for `/api/cron/dispatch` appears.

- [ ] **Step 5: Manual smoke test**

1. Open https://green-rides.vercel.app/drivers — should see landing page
2. Log in via OTP → should redirect to `/drivers/register`
3. Open Telegram bot, send `/start` → receive 6-digit code
4. Complete registration form with the code → redirected to `/drivers/pending`
5. In admin (`/admin/drivers`) → approve the driver → driver receives Telegram notification
6. Driver logs back in → redirected to `/drivers/dashboard`
7. Driver opens Schedule tab → fills next 7 days
8. Driver toggles Online
9. Rider submits a ride request → driver receives Telegram notification + in-app DispatchCard appears

---

## Self-Review Notes

- All Supabase client DB calls use table names matching the Prisma model names (PascalCase): `DriverProfile`, `DriverDispatch`, `TelegramCode`, `RideRequest`, `User`
- `buildDispatchQueue` is a fire-and-forget (`.catch` logged) so it never blocks the rider's request response
- The `DispatchCard` uses `prompt()` for ETA — acceptable for v1, replace with a bottom sheet in a future iteration
- Riders do not currently link Telegram during sign-up, so rider notifications via Telegram are best-effort (the code handles `null` `telegram_chat_id` gracefully)
- The `proxy.ts` matcher covers new routes but the layout guard handles the role-based redirect logic — two layers of protection
