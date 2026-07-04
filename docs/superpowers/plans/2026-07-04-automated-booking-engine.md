# Automated Booking Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the PLG booking engine by adding a 4-hour auto-cancel cron for unaccepted requests and updating the admin UI to reflect that manual confirm is now an override, not the primary flow.

**Architecture:** The auto-confirm on driver accept is already implemented in `src/app/api/requests/[id]/respond/route.ts` (driver accept → CONFIRMED + driver details + OTP + rider notification). The two remaining pieces are: (1) a new hourly cron that cancels PENDING requests older than 4 hours and Telegrams admin, (2) a label/copy change in the admin bookings page.

**Tech Stack:** Next.js 16 App Router, Supabase admin client, existing `sendTelegramMessage` lib, existing Vercel cron auth pattern (`x-vercel-cron: 1` or `Authorization: Bearer CRON_SECRET`).

---

## File Map

| File | Action |
|------|--------|
| `src/app/api/cron/auto-cancel/route.ts` | **Create** — hourly cron handler |
| `vercel.json` | **Modify** — add cron schedule |
| `src/app/(admin)/admin/bookings/page.tsx` | **Modify** — rename button + helper text |

---

## Task 1: Auto-Cancel Cron Route

**Files:**
- Create: `src/app/api/cron/auto-cancel/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isInternal   = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isInternal) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const db      = getAdminClient();
  const cutoff  = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const now     = new Date().toISOString();

  const { data: stale, error } = await db
    .from("RideRequest")
    .select("id, from_city, to_city, travel_date, rider_phone, created_at")
    .eq("status", "PENDING")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[auto-cancel]", error);
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return Response.json({ data: { cancelled: 0 }, error: null });
  }

  const ids = stale.map((r) => r.id);

  const { error: updateErr } = await db
    .from("RideRequest")
    .update({ status: "CANCELLED", updated_at: now })
    .in("id", ids);

  if (updateErr) {
    console.error("[auto-cancel] update failed", updateErr);
    return Response.json({ data: null, error: updateErr.message }, { status: 500 });
  }

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    await Promise.allSettled(
      stale.map((r) => {
        const date = new Date(r.travel_date).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
        });
        const booked = new Date(r.created_at).toLocaleString("en-IN", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
        });
        return sendTelegramMessage(
          adminChatId,
          `❌ <b>No driver found — auto-cancelled</b>\n\nRoute: ${r.from_city} → ${r.to_city}\nDate: ${date}\nRider: ${r.rider_phone}\nBooked: ${booked}`,
        );
      }),
    );
  }

  console.log(`[auto-cancel] Cancelled ${ids.length} stale request(s):`, ids);
  return Response.json({ data: { cancelled: ids.length }, error: null });
}
```

- [ ] **Step 2: Verify the file exists and TypeScript is happy**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/app/api/cron/auto-cancel/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/auto-cancel/route.ts
git commit -m "feat: auto-cancel PENDING requests older than 4 hours"
```

---

## Task 2: Register Cron in vercel.json

**Files:**
- Modify: `vercel.json`

Current `vercel.json` crons array:
```json
"crons": [
  {
    "path": "/api/cron/confirm-improve",
    "schedule": "30 3 * * *"
  }
]
```

- [ ] **Step 1: Add the auto-cancel cron entry**

Replace the `crons` array in `vercel.json` with:

```json
"crons": [
  {
    "path": "/api/cron/confirm-improve",
    "schedule": "30 3 * * *"
  },
  {
    "path": "/api/cron/auto-cancel",
    "schedule": "0 * * * *"
  }
]
```

`0 * * * *` = top of every hour, UTC. Vercel runs crons in UTC; the 4-hour window is calculated server-side so timezone doesn't matter.

- [ ] **Step 2: Verify vercel.json is valid JSON**

Run: `node -e "require('./vercel.json'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: register auto-cancel cron — every hour"
```

---

## Task 3: Admin UI — Override Labelling

**Files:**
- Modify: `src/app/(admin)/admin/bookings/page.tsx`

The PENDING booking card currently shows a `"Confirm →"` button and no explanation. Since auto-confirm now handles the happy path, update the label and add a helper line so admin understands this is a manual override.

- [ ] **Step 1: Rename the Confirm button label**

Find this line (around line 204):
```tsx
{req.status === "PENDING" ? "Confirm →" : "Mark Done ✓"}
```

Replace with:
```tsx
{req.status === "PENDING" ? "Assign Driver ↗" : "Mark Done ✓"}
```

- [ ] **Step 2: Add helper text under each PENDING card's meta row**

Find this block (the rider info row, around line 185–197):
```tsx
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-sub">Rider</p>
                  <p className="text-sm font-semibold text-text">
                    {req.rider.name ?? "—"} · {req.rider_phone}
                  </p>
                </div>
                <a href={`tel:${req.rider_phone}`}
                  className="w-9 h-9 rounded-full bg-pale flex items-center justify-center">
                  <Phone className="w-4 h-4 text-leaf" />
                </a>
              </div>
              <p className="text-[10px] text-sub/60 mt-2 font-mono-green">#{req.id.slice(0, 8).toUpperCase()}</p>
```

Replace with:
```tsx
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-sub">Rider</p>
                  <p className="text-sm font-semibold text-text">
                    {req.rider.name ?? "—"} · {req.rider_phone}
                  </p>
                </div>
                <a href={`tel:${req.rider_phone}`}
                  className="w-9 h-9 rounded-full bg-pale flex items-center justify-center">
                  <Phone className="w-4 h-4 text-leaf" />
                </a>
              </div>
              <p className="text-[10px] text-sub/60 mt-2 font-mono-green">#{req.id.slice(0, 8).toUpperCase()}</p>
              {req.status === "PENDING" && (
                <p className="text-xs text-sub italic mt-1">
                  Waiting for a driver to accept — or assign one manually below.
                </p>
              )}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/bookings/page.tsx"
git commit -m "fix(admin): relabel confirm as override, add pending helper text"
```

---

## Task 4: Push and Deploy

- [ ] **Step 1: Push all commits**

```bash
git push
```

Expected: `main -> main` pushed successfully. Vercel auto-deploys via GitHub webhook.

- [ ] **Step 2: Smoke test auto-confirm (existing flow)**

1. Log in to the fleet app at `fleet.greenrides.co.in` as a driver
2. Make a test booking at `greenrides.co.in` for tomorrow
3. In the fleet app, accept the dispatch
4. Check `greenrides.co.in/bookings` — the booking should show CONFIRMED with driver name + phone within 10 seconds, **without any admin action**

- [ ] **Step 3: Smoke test cron (manual trigger)**

```bash
curl -X GET https://greenrides.co.in/api/cron/auto-cancel \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected: `{"data":{"cancelled":0},"error":null}` (or N if you have stale test bookings)

- [ ] **Step 4: Verify admin UI**

Open `greenrides.co.in/admin/bookings` with a PENDING request visible.
Confirm:
- Button reads "Assign Driver ↗" (not "Confirm →")
- Helper text "Waiting for a driver to accept — or assign one manually below." appears under the rider row
