# Green Rides Daily Improvement Engine — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A fully autonomous agent that runs every morning at 8am IST, picks the next improvement from a 30-item backlog, implements it, deploys it to production, runs smoke tests, and notifies the owner via Telegram — with a 30-minute rollback veto window.

**Architecture:** GitHub repo → Vercel git integration → GitHub Actions cron → Claude API code generation → auto-deploy → smoke test → Telegram notification → Supabase audit log → Admin dashboard.

**Tech Stack:** GitHub Actions, Claude API (claude-sonnet-4-6), Vercel Deploy API, Supabase, Telegram Bot API, TypeScript (tsx), Next.js 16 App Router.

**Scope:** Frontend only — UI/UX improvements and new frontend features. No API route changes, no DB schema migrations, no new npm packages.

---

## 1. Overall Architecture

```
DAILY CYCLE (8:00 AM IST / 2:30 AM UTC)

GitHub Actions Cron
  → scripts/daily-improve.ts
      ├── reads docs/improvements/backlog.json (next pending item)
      ├── reads relevant source files into memory
      ├── calls Claude API → receives file changes
      ├── writes changed files to disk
      └── exits (workflow commits + pushes)
  → git push main → Vercel auto-deploys (GitHub integration)
  → polls Vercel API until READY or ERROR (max 10 min, 15s intervals)
  → runs smoke tests (5 critical URLs, expect HTTP 200)
  → writes row to Supabase ImprovementLog
  → sends Telegram notification

30-MINUTE VETO WINDOW
  "ROLLBACK" → /api/telegram/webhook → Vercel rollback API → log updated
  "STATUS"   → Telegram reply with today's title + status
  "SKIP"     → marks item skipped, moves to next pending

8:32 AM IST — /api/cron/confirm-improve
  → if no rollback received → ImprovementLog status = "completed"
```

**Key design decisions:**
- `backlog.json` is the source of truth — human-readable, editable, version-controlled. Bump priority by reordering entries.
- `ImprovementLog` Supabase table is the runtime log — status updates happen in real time as the deploy progresses.
- The existing `/api/telegram/webhook` is extended minimally — new command handlers only, nothing existing is changed.
- `rollbackImprovement()` is extracted as a shared util used by both the Telegram webhook and the admin dashboard rollback button — no duplicate logic.
- Claude API prompt uses a structured output format (`<file path="...">content</file>`) for reliable parsing.

---

## 2. File Structure

```
New files:
  .github/workflows/daily-improve.yml     — cron workflow
  scripts/daily-improve.ts                — improvement agent script
  scripts/lib/vercel-api.ts               — Vercel API helpers (poll, rollback)
  scripts/lib/telegram.ts                 — Telegram send helper
  scripts/lib/smoke-test.ts               — smoke test runner
  scripts/lib/rollback.ts                 — shared rollbackImprovement() util
  docs/improvements/backlog.json          — 30-item living backlog

Modified files:
  src/app/api/telegram/webhook/route.ts   — add ROLLBACK/STATUS/SKIP handlers
  src/app/api/cron/confirm-improve/route.ts — new cron route (auto-confirm at 8:32am)
  src/app/api/admin/improvements/route.ts — new admin API route
  src/app/admin/improvements/page.tsx     — new admin dashboard page
  vercel.json (or equivalent)             — add confirm-improve cron schedule
```

---

## 3. Supabase Schema

```sql
CREATE TABLE "ImprovementLog" (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day              integer NOT NULL,
  title            text NOT NULL,
  portal           text NOT NULL,   -- rider | driver | fleet | admin | all
  area             text NOT NULL,   -- ux | feature | perf
  status           text NOT NULL DEFAULT 'building',
                                    -- building | live | completed |
                                    -- rolled_back | failed | skipped
  files_changed    text[] DEFAULT '{}',
  deployment_id    text,
  deployment_url   text,
  smoke_tests_passed boolean,
  veto_expires_at  timestamptz,
  completed_at     timestamptz,
  rolled_back_at   timestamptz,
  notes            text,
  created_at       timestamptz DEFAULT now()
);
```

---

## 4. `backlog.json` Schema

Each entry:

```json
{
  "day": 1,
  "title": "Skeleton loading screens",
  "portal": "rider",
  "area": "ux",
  "description": "Add skeleton loading screens on home, search results, and bookings pages to eliminate the blank flash while data loads.",
  "files": [
    "src/app/page.tsx",
    "src/app/rides/page.tsx",
    "src/app/bookings/page.tsx"
  ],
  "prompt_hint": "Add Tailwind animate-pulse skeleton divs that mirror the layout of the loaded content. Show while loading=true. Remove when data arrives. No new components — inline in the page file.",
  "status": "pending",
  "completed_at": null,
  "deployment_id": null
}
```

**All 30 items:**

| Day | Title | Portal | Area |
|-----|-------|--------|------|
| 1 | Skeleton loading screens on home, search, bookings | rider | ux |
| 2 | Booking confirmation full-screen — OTP prominent, driver name, departure | rider | ux |
| 3 | Seat availability visual pills (●●●●○) on ride cards | rider | ux |
| 4 | Empty states with illustration and CTA on bookings, search, ride history | rider | ux |
| 5 | Fare breakdown — per seat × seats = total shown before booking | rider | ux |
| 6 | Route pages — "Book this route" CTA + live fare estimate chip | rider | feature |
| 7 | Offline detection banner with auto-retry on reconnect | rider | ux |
| 8 | Driver earnings 7-day bar chart (CSS-only, no library) | driver | feature |
| 9 | Dispatch card — show rider star rating before Accept/Reject | driver | ux |
| 10 | "Post Ride" quick-action button on driver Home tab | driver | feature |
| 11 | Rides tab — passenger count badge on each ride card | driver | ux |
| 12 | Schedule tab — "X available days this month" summary chip | driver | ux |
| 13 | Me tab — profile completion progress bar + what's missing | driver | ux |
| 14 | Loading skeletons on all 5 driver dashboard tabs | driver | ux |
| 15 | Fleet utilization card on owner dashboard (active ÷ total %) | fleet | feature |
| 16 | My Fleet top summary bar — active / inactive / unassigned counts | fleet | ux |
| 17 | Earnings per vehicle breakdown table | fleet | feature |
| 18 | Driver performance column on Fleet Drivers — trips this week | fleet | feature |
| 19 | Dashboard alert dot when drivers have no assigned vehicle | fleet | ux |
| 20 | Vehicle card — inline "Assign Driver" dropdown | fleet | ux |
| 21 | Monthly revenue mini trend chart on owner dashboard | fleet | feature |
| 22 | Admin metrics bar — today's bookings, active rides, new signups | admin | feature |
| 23 | Applicants — bulk select + approve/reject with one click | admin | feature |
| 24 | Drivers list — search input + status filter tabs | admin | ux |
| 25 | Documents — pending count badge + per-driver verification ring | admin | ux |
| 26 | Dispatch — manual dispatch button with driver dropdown | admin | feature |
| 27 | Used cars — status filter tabs + inquiry count badge | admin | ux |
| 28 | Cross-portal "What's new" chip in each portal header | all | ux |
| 29 | Mobile polish pass — back-button modal close, scroll anchoring | all | ux |
| 30 | Performance pass — lazy-load images, preconnect hints, layout shift | all | perf |

---

## 5. GitHub Actions Workflow

**File:** `.github/workflows/daily-improve.yml`

```yaml
name: Daily Improvement Agent
on:
  schedule:
    - cron: '30 2 * * *'   # 8:00 AM IST = 2:30 AM UTC
  workflow_dispatch:
    inputs:
      day_override:
        description: 'Force a specific day number (leave blank for auto)'
        required: false

jobs:
  improve:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Run improvement agent
        env:
          ANTHROPIC_API_KEY:         ${{ secrets.ANTHROPIC_API_KEY }}
          NEXT_PUBLIC_SUPABASE_URL:  ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VERCEL_TOKEN:              ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID:         ${{ secrets.VERCEL_PROJECT_ID }}
          TELEGRAM_BOT_TOKEN:        ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID:          ${{ secrets.TELEGRAM_CHAT_ID }}
          DAY_OVERRIDE:              ${{ github.event.inputs.day_override }}
        run: npx tsx scripts/daily-improve.ts

      - name: Commit and push
        run: |
          git config user.name "Green Rides Improvement Agent"
          git config user.email "agent@greenrides.co.in"
          git add -A
          git diff --staged --quiet || git commit -m "improve(day-$(cat /tmp/gr-day)): $(cat /tmp/gr-title)"
          git push
```

The script writes the day number and title to `/tmp/gr-day` and `/tmp/gr-title` so the commit message is accurate.

**Required GitHub Secrets:**
- `GH_PAT` — Personal Access Token with `repo` scope (so the workflow can push)
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL_TOKEN` + `VERCEL_PROJECT_ID`
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`

---

## 6. Improvement Script (`scripts/daily-improve.ts`)

**Full execution flow:**

```
1.  Read backlog.json → find first item with status === "pending"
    (or item matching DAY_OVERRIDE)

2.  Idempotency guard: check ImprovementLog for today's date
    If row exists → exit 0 (already ran today)

3.  Insert ImprovementLog row: { status: "building", day, title, portal, area }

4.  Read each file in item.files into memory

5.  Build Claude prompt:
    System: Green Rides design system, Next.js 16 conventions,
            output format rules, frontend-only constraint
    User:   item.description + item.prompt_hint + file contents

6.  Call Anthropic SDK (claude-sonnet-4-6, max_tokens: 8000)

7.  Parse response: extract <file path="...">content</file> blocks

8.  Write each file to disk

9.  Write day number to /tmp/gr-day, title to /tmp/gr-title
    (consumed by the git commit step in the workflow)

10. Update backlog.json item: status → "in_progress"

11. Exit (workflow commits + pushes)

[Workflow pushes → Vercel starts deploy]

12. Poll Vercel GET /v13/deployments?projectId=...&limit=1
    every 15 seconds, up to 10 minutes
    → on READY: proceed
    → on ERROR: mark failed, send Telegram error, exit 1

13. Run smoke tests:
    GET https://greenrides.co.in/              expect 200
    GET https://greenrides.co.in/rides         expect 200
    GET https://greenrides.co.in/fleet/login   expect 200
    GET https://greenrides.co.in/drivers       expect 200
    GET https://greenrides.co.in/admin         expect 200
    → any failure: auto-rollback via Vercel API, mark failed, exit 1

14. Update ImprovementLog:
    status = "live"
    deployment_id, deployment_url, smoke_tests_passed = true
    veto_expires_at = now + 30 minutes

15. Send Telegram notification (see format in Section 7)
```

**Claude system prompt (condensed):**
```
You are a senior frontend engineer implementing a specific UI improvement
for Green Rides — an intercity cab booking app built with Next.js 16 App
Router and Tailwind CSS.

Design system tokens: text-forest, text-leaf, text-lime, text-sub, text-text,
bg-cream, bg-pale, bg-forest, border-border, font-display (Fraunces),
font-mono-green. Use these — never raw hex colors.

Rules:
- Modify only the files provided. Do not import new npm packages.
- Do not change API routes, Supabase queries, or auth logic.
- Keep changes minimal and focused on the stated improvement.
- Follow the existing code style in each file exactly.

Output format — for EVERY file you change, output exactly:
<file path="src/app/example/page.tsx">
[complete new file content]
</file>

Output ONLY these blocks. No explanation text.
```

---

## 7. Telegram Notification Format

```
🟢 Day 8 live — greenrides.co.in

📌 Earnings 7-day bar chart
Portal: Driver · Feature

Files changed:
• src/app/drivers/dashboard/page.tsx

✅ Build passed · Smoke tests 5/5
🔗 greenrides.co.in/drivers/dashboard

Reply ROLLBACK within 30 min to revert.
Auto-confirmed at 8:31 AM IST.
```

**Failure format:**
```
⚠️ Day 8 failed — auto-rolled back

Earnings 7-day bar chart

Reason: smoke test failed (/drivers/dashboard returned 500)
Previous version restored. Tomorrow's improvement runs as scheduled.
```

---

## 8. Telegram Webhook Commands

Three new handlers in `/api/telegram/webhook`:

**ROLLBACK:**
1. Find today's ImprovementLog row where `status = "live"`
2. Check `veto_expires_at > now` (still in window)
3. Call `rollbackImprovement(deployment_id)` shared util
4. Update log: `status = "rolled_back"`, `rolled_back_at = now`
5. Reply: "↩️ Rolled back. Previous version is live."

**STATUS:**
1. Find today's ImprovementLog row
2. Reply with title, portal, status, deployment_url

**SKIP:**
1. Find today's ImprovementLog row
2. Update: `status = "skipped"`
3. Find today's backlog.json item → `status = "skipped"`
4. Skipped items stay skipped permanently. To re-run a skipped day, manually set its status back to `"pending"` in `backlog.json`.
5. Reply: "⏭️ Skipped. Tomorrow's improvement runs as scheduled."

`rollbackImprovement(deploymentId)` is a shared util in `scripts/lib/rollback.ts`, imported by both the Telegram webhook and the admin dashboard API route — single source of truth.

---

## 9. Auto-Confirm Cron (`/api/cron/confirm-improve`)

Runs at 9:00 AM IST (3:30 AM UTC / cron: `30 3 * * *`). Added to Vercel cron config. Running at 9:00 AM guarantees the 30-minute veto window is always closed regardless of how long the deploy took (max 10 min deploy + 30 min window = at most 8:40 AM).

```
1. Find ImprovementLog row where:
   status = "live" AND veto_expires_at < now
2. Update: status = "completed", completed_at = now
3. Find corresponding backlog.json item → status = "completed"
   (written to Supabase; synced to file on next agent commit)
```

---

## 10. Admin Dashboard (`/admin/improvements`)

**New page — read-only except for Rollback button:**

```
Header:
  "Improvement Engine"     Day 8 of 30
  Progress bar: ████████░░░░░░░░░░  27%

Today card (shown while veto window open):
  [status badge]  Day 8 — Earnings 7-day bar chart
  Portal: Driver · Feature
  Deployed 8:01 AM · Smoke tests 5/5 ✓
  greenrides.co.in/drivers/dashboard ↗
  [Rollback button — disabled after veto_expires_at]

History table (paginated, 10 per page):
  Day | Title | Portal | Status | Date | Link

Upcoming section (next 7 pending items from backlog.json):
  Day 9  · Dispatch card rider rating · Driver
  Day 10 · Post Ride quick action · Driver
  ...
```

**`/api/admin/improvements` route:**
```
GET → { today: ImprovementLog row, history: ImprovementLog[], upcoming: backlog items[] }
POST { action: "rollback" | "skip" } → calls shared util
```

Uses existing admin auth (`ADMIN_SECRET` header). No new auth logic.

---

## 11. One-Time Setup Checklist

```
□ git init in project root
□ Create GitHub repo, push initial commit
□ Connect Vercel to GitHub repo (replace manual deploy)
□ Add all GitHub Secrets (listed in Section 5)
□ Create ImprovementLog table in Supabase
□ Run: npx tsx scripts/seed-backlog.ts  (writes backlog.json)
□ Test workflow manually via workflow_dispatch before day 1
□ Set Vercel cron for confirm-improve (2:32 AM UTC)
□ Confirm Telegram bot is configured and TELEGRAM_CHAT_ID is correct
```

---

## 12. Safety Constraints (Hardcoded, Never Overridden)

The improvement script enforces these regardless of what the backlog item says:

- **No API routes** — the script refuses to write any file under `src/app/api/`
- **No auth files** — refuses to write `proxy.ts`, any auth route, or Supabase client files
- **No package.json** — no new dependencies
- **No env files** — no `.env*` files
- **Max 5 files per improvement** — if Claude returns more than 5 `<file>` blocks, the run is aborted
- **Max diff size 400 lines** — if total lines changed exceeds 400, the run is aborted and marked "skipped"

These guards run before any file is written to disk.
