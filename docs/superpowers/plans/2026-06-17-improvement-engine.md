# Green Rides Daily Improvement Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully autonomous daily improvement agent that runs at 8am IST via GitHub Actions, picks the next item from a 30-item backlog, generates frontend code via Claude API, deploys to production via Vercel GitHub integration, runs smoke tests, and notifies via Telegram with a 30-minute rollback veto window — plus an admin dashboard to view the 30-day log.

**Architecture:** Two-phase GitHub Actions workflow (pre-deploy: generate + write files; post-deploy: poll Vercel + smoke test + notify), shared utility scripts in `scripts/lib/`, living backlog in `docs/improvements/backlog.json`, Supabase `ImprovementLog` table for runtime state, admin page at `/admin/improvements`.

**Tech Stack:** GitHub Actions, Anthropic SDK (claude-sonnet-4-6), Vercel Deploy API, Supabase (supabase-js), Telegram Bot API, TypeScript (tsx — already installed).

---

## File Map

```
New files:
  docs/improvements/backlog.json                      — 30-item living backlog
  scripts/lib/backlog.ts                              — read/write backlog.json helpers
  scripts/lib/vercel-api.ts                           — poll deployment, rollback helpers
  scripts/lib/telegram.ts                             — send Telegram message (scripts context)
  scripts/lib/smoke-test.ts                           — smoke test runner
  scripts/lib/rollback.ts                             — shared rollbackImprovement() util
  scripts/daily-improve.ts                            — phase 1: read backlog → call Claude → write files
  scripts/post-deploy.ts                              — phase 2: poll Vercel → smoke test → notify
  .github/workflows/daily-improve.yml                 — cron at 2:30 AM UTC (8:00 AM IST)
  src/app/api/cron/confirm-improve/route.ts           — auto-confirm at 3:30 AM UTC (9:00 AM IST)
  src/app/api/admin/improvements/route.ts             — admin API: history + rollback + skip
  src/app/(admin)/admin/improvements/page.tsx         — admin dashboard: 30-day audit trail
  vercel.json                                         — cron schedule for confirm-improve

Modified files:
  src/app/api/telegram/webhook/route.ts               — add ROLLBACK / STATUS / SKIP handlers
```

---

## Task 1: Git init and GitHub setup

**Files:** none (shell commands only)

- [ ] **Step 1: Initialize git repo**

```powershell
cd "C:\Users\dhira\Downloads\Green\green-rides"
git init
```

Expected: `Initialized empty Git repository in .../.git/`

- [ ] **Step 2: Create .gitignore**

Create `.gitignore` in project root with:

```
node_modules/
.next/
.env
.env.local
.env.production
*.env
.vercel/
prisma/generated/
playwright-report/
test-results/
/tmp/
```

- [ ] **Step 3: Stage and commit everything**

```powershell
git add -A
git commit -m "chore: initial commit — Green Rides production codebase"
```

Expected: commit created with 100+ files

- [ ] **Step 4: Create GitHub repo and push**

Go to https://github.com/new — create a repo named `green-rides` (private). Then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/green-rides.git
git branch -M main
git push -u origin main
```

Expected: push succeeds, repo visible on GitHub

- [ ] **Step 5: Switch Vercel to GitHub integration**

1. Go to https://vercel.com → open the green-rides project → Settings → Git
2. Click "Connect Git Repository" → select the `green-rides` GitHub repo → branch: `main`
3. Vercel will trigger a deployment from GitHub automatically — let it complete
4. Confirm `greenrides.co.in` still resolves correctly after this deploy

- [ ] **Step 6: Verify auto-deploy works**

Make a trivial change (e.g. add a space in any `.tsx` file), commit and push:

```powershell
git add -A
git commit -m "test: verify vercel github integration"
git push
```

Watch Vercel dashboard — should auto-deploy within 2 minutes. Revert the change after confirming.

---

## Task 2: Create Supabase ImprovementLog table

**Files:** Supabase SQL editor only

- [ ] **Step 1: Run this SQL in Supabase SQL editor**

```sql
CREATE TABLE "ImprovementLog" (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day                integer NOT NULL,
  title              text NOT NULL,
  portal             text NOT NULL,
  area               text NOT NULL,
  status             text NOT NULL DEFAULT 'building',
  files_changed      text[] DEFAULT '{}',
  deployment_id      text,
  deployment_url     text,
  smoke_tests_passed boolean,
  veto_expires_at    timestamptz,
  completed_at       timestamptz,
  rolled_back_at     timestamptz,
  notes              text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX improvement_log_day_idx ON "ImprovementLog" (day);
CREATE INDEX improvement_log_status_idx ON "ImprovementLog" (status);
CREATE INDEX improvement_log_created_idx ON "ImprovementLog" (created_at DESC);
```

- [ ] **Step 2: Verify table exists**

Run in SQL editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ImprovementLog' ORDER BY ordinal_position;
```

Expected: 14 rows, one per column.

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "feat: add ImprovementLog table (SQL run in Supabase)"
```

---

## Task 3: Create docs/improvements/backlog.json

**Files:**
- Create: `docs/improvements/backlog.json`

- [ ] **Step 1: Create the directory**

```powershell
New-Item -ItemType Directory -Force "docs\improvements"
```

- [ ] **Step 2: Write backlog.json**

Create `docs/improvements/backlog.json` with this exact content:

```json
{
  "items": [
    {
      "day": 1,
      "title": "Skeleton loading screens — rider pages",
      "portal": "rider",
      "area": "ux",
      "description": "Add skeleton loading screens on the home page, ride search/listing page, and bookings page to eliminate the blank flash while data loads.",
      "files": ["src/app/page.tsx", "src/app/(booking)/rides/page.tsx", "src/app/bookings/page.tsx"],
      "prompt_hint": "While loading=true, show animate-pulse skeleton divs using bg-border that mirror the exact layout of the loaded content. Use rounded-xl for card skeletons, rounded-full for avatar/icon placeholders. When loading=false and data arrives, render the real content. Do not add a new component — inline the skeleton JSX in the existing conditional render.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 2,
      "title": "Booking confirmation full-screen redesign",
      "portal": "rider",
      "area": "ux",
      "description": "Redesign the booking confirmation page into a full-screen success state with the OTP prominently displayed so the rider can show it to the driver.",
      "files": ["src/app/(booking)/confirm/page.tsx"],
      "prompt_hint": "Show: (1) large green checkmark icon (CheckCircle w-16 h-16 text-leaf), (2) 'Booking Confirmed!' in font-display text-2xl text-forest, (3) an OTP box: bg-forest rounded-2xl p-5, label 'Show this to your driver' in text-lime/60 text-xs uppercase, the OTP digits in font-mono text-4xl text-lime tracking-[0.3em]. Below the OTP box: route (from → to) in text-text font-semibold, departure date in text-sub. Add a 'View My Bookings' button linking to /bookings.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 3,
      "title": "Seat availability visual pills on ride cards",
      "portal": "rider",
      "area": "ux",
      "description": "Replace the plain text '4 seats available' on ride listing cards with a visual row of filled/empty circles showing booked vs available seats.",
      "files": ["src/app/(booking)/rides/page.tsx"],
      "prompt_hint": "For each ride card, render a row of circles (max 8 shown). Booked seats = filled circle (w-2.5 h-2.5 rounded-full bg-sub inline-block). Available seats = empty circle (w-2.5 h-2.5 rounded-full border border-leaf inline-block). Space them with gap-1. Cap at 8 circles even for larger vehicles. Keep existing seat count text as a subtitle in text-xs text-sub beneath the circles.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 4,
      "title": "Empty states with CTA on rider pages",
      "portal": "rider",
      "area": "ux",
      "description": "When data arrays are empty (not loading), show illustrated empty states with a call-to-action instead of blank sections.",
      "files": ["src/app/bookings/page.tsx", "src/app/(booking)/rides/page.tsx"],
      "prompt_hint": "For bookings page empty state: Ticket icon (w-12 h-12 text-sub/40), heading 'No bookings yet' (text-lg font-semibold text-text), subtitle 'Your upcoming and past rides will appear here' (text-sm text-sub), CTA button 'Find a ride →' (bg-leaf text-white font-semibold px-5 py-3 rounded-xl) linking to /rides. For rides page with no results: Search icon, heading 'No rides found', subtitle 'Try different dates or cities', CTA 'Clear filters'. Wrap in a flex-col items-center py-16 gap-3 div.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 5,
      "title": "Fare breakdown before booking confirmation",
      "portal": "rider",
      "area": "ux",
      "description": "Show a per-seat × seat-count = total calculation before the user confirms booking, so there are no fare surprises.",
      "files": ["src/app/(booking)/rides/page.tsx", "src/app/(booking)/confirm/page.tsx"],
      "prompt_hint": "In the booking summary/confirmation step, add a fare breakdown row: '₹{farePerSeat} × {seats} seat{s} = ₹{total}' in text-sm text-sub. The total should be in font-display text-lg text-forest font-bold. Update dynamically when seat count changes. Convert from paise: fare_paise / 100. Place directly above the 'Book Now' / 'Confirm' button.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 6,
      "title": "Route pages — Book CTA and fare estimate chip",
      "portal": "rider",
      "area": "feature",
      "description": "Add a sticky 'Book this route' button and a live fare estimate chip to the /routes/[slug] SEO pages.",
      "files": ["src/app/routes/[slug]/page.tsx"],
      "prompt_hint": "Add a sticky bottom bar (fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 flex items-center justify-between z-10). Left side: 'From ₹{minFare}' in font-display text-xl text-forest (show only if fare data is available; omit if unknown). Right side: a Link to /rides?from={fromCity}&to={toCity} styled as bg-leaf text-white font-bold px-6 py-3 rounded-xl 'Book Now →'. Add pb-20 to the page content div to avoid content being hidden behind the sticky bar.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 7,
      "title": "Offline detection banner",
      "portal": "rider",
      "area": "ux",
      "description": "Show a banner when the user loses internet connection, with an auto-retry when they reconnect.",
      "files": ["src/app/layout.tsx"],
      "prompt_hint": "Add a new 'use client' component OfflineBanner inside layout.tsx (not a separate file). Use useEffect to add/remove listeners on window 'online' and 'offline' events. When offline: render a fixed top banner (fixed top-0 inset-x-0 z-50 bg-gold text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2). Show WifiOff icon from lucide-react and text 'You're offline — check your connection'. When back online: call toast.success('Back online') and hide the banner. The banner should animate in with transition-all.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 8,
      "title": "Driver earnings 7-day bar chart",
      "portal": "driver",
      "area": "feature",
      "description": "Add a 7-day earnings bar chart to the Earnings tab of the driver dashboard using only CSS — no charting library.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "In the earnings tab, above the existing earnings cards, add a 7-day chart. Compute last 7 calendar days from today (Asia/Kolkata). For each day, sum earnings from completed rides and requests that day. Render as a row of 7 bars: each bar is a flex-col items-center gap-1 div. The bar itself is a div with bg-leaf/80 rounded-t-lg w-8, height proportional to that day's earnings relative to the max (use inline style height: `${(dayEarnings/maxEarnings)*80}px`, min-height: 4px). Below: day label in text-[10px] text-sub (Mon/Tue/etc). Highlight today's bar with bg-leaf. Show '₹0' days as minimum height bars in bg-pale.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 9,
      "title": "Dispatch card — show rider star rating",
      "portal": "driver",
      "area": "ux",
      "description": "Show the rider's average star rating on the dispatch card before the driver accepts or rejects.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "In the PENDING dispatch card section, after the route/fare/date line, add a rider info row. Fetch the rider's rating from the existing request data (add avg_rating to the RideRequest select query if not already present, or use a placeholder 4.8 if unavailable). Render: Star icon (w-3 h-3 text-gold fill-gold) + '{rating} rider rating' in text-xs text-sub. Place this between the fare/date row and the notes (if any), before the Accept/Reject buttons.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 10,
      "title": "Post Ride quick-action on driver home tab",
      "portal": "driver",
      "area": "feature",
      "description": "Add a prominent 'Post a Ride' quick-action card on the driver dashboard Home tab so drivers can quickly post new rides.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "In the HOME tab section, when there is no active_dispatch, add a 'Post a Ride' quick-action card below the online toggle. Style: bg-white border border-border rounded-2xl p-4 flex items-center gap-4. Left: a rounded icon box bg-leaf/10 w-12 h-12 flex items-center justify-center with Plus icon text-leaf. Center: title 'Post a Ride' font-semibold text-text, subtitle 'Share your route and earn more' text-xs text-sub. Right: ArrowRight icon text-sub. Wrap the whole card in an <a href='/drivers/post-ride'> tag.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 11,
      "title": "Rides tab — passenger count badge",
      "portal": "driver",
      "area": "ux",
      "description": "Show a passenger count badge on each ride card in the driver dashboard Rides tab.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "On each ride card in the RIDES tab, add a passenger count indicator. Calculate booked seats: total_seats - available_seats. Show as a small badge next to the status badge: Users icon (w-3 h-3) + '{bookedSeats}/{totalSeats} passengers' in text-[10px] text-sub bg-pale px-1.5 py-0.5 rounded-full. Place it in the top-right area of the card next to the existing status badge, or on a second line below the route.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 12,
      "title": "Schedule tab — available days summary chip",
      "portal": "driver",
      "area": "ux",
      "description": "Show a summary chip at the top of the Schedule tab telling the driver how many days this month they're available.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "At the top of the SCHEDULE tab (before the AvailabilityCalendar), add a summary chip. Count the days in the current month that are NOT marked as rest days in localAvail. Show: bg-pale rounded-full px-4 py-2 inline-flex items-center gap-2, CalendarDays icon text-leaf w-4 h-4, text '{n} available days this month' in text-sm font-semibold text-text. If n === 0, change the bg to bg-gold/10 and text to text-gold to prompt the driver to mark availability.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 13,
      "title": "Me tab — profile completion progress bar",
      "portal": "driver",
      "area": "ux",
      "description": "Add a profile completion progress bar on the Me tab showing the driver what they still need to fill in.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "In the PROFILE tab, above the form inputs, add a completion meter. Check which fields have values: name (profileForm.name), license_number, vehicle_number, vehicle_model. Score = filled fields / 4. Render: a label 'Profile {score*100}% complete' in text-sm font-semibold text-text, then a progress bar: bg-pale rounded-full h-2 w-full with an inner div bg-leaf rounded-full h-2 style={{width: `${score*100}%`}} transition-all. Below the bar, if score < 1: list missing fields in text-xs text-sub as 'Missing: name, licence number' etc.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 14,
      "title": "Loading skeletons on all driver dashboard tabs",
      "portal": "driver",
      "area": "ux",
      "description": "Add per-tab loading skeletons to the driver dashboard so tabs show a skeleton instead of an empty state while data loads.",
      "files": ["src/app/drivers/dashboard/page.tsx"],
      "prompt_hint": "The dashboard already has loadingRequests and loadingRides state. Add similar loadingEarnings state initialized to false, set to true when earnings tab loads, false when done. For each tab that has a loading state, when loading is true show 3 skeleton cards: bg-white border border-border rounded-2xl p-4 animate-pulse with inner divs of bg-border rounded-lg h-4 w-3/4 mb-2 and bg-border rounded-lg h-3 w-1/2. This replaces the immediate empty state that currently shows while data loads.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 15,
      "title": "Fleet utilization card on owner dashboard",
      "portal": "fleet",
      "area": "feature",
      "description": "Add a fleet utilization percentage card to the owner dashboard showing how many vehicles are active vs total.",
      "files": ["src/app/(fleet)/fleet/dashboard/page.tsx"],
      "prompt_hint": "Fetch the vehicles count from the existing dashboard data (or from /api/fleet/vehicles if not already loaded). Show a new card: bg-white border border-border rounded-2xl p-5. Title: 'Fleet Utilization' in text-xs font-bold text-sub uppercase. Large number: '{activeCount}/{totalCount}' in font-display text-3xl text-forest. Subtitle: '{pct}% active' in text-sm text-sub. A simple progress bar: bg-pale h-2 rounded-full with inner bg-leaf rounded-full width={pct}%. Place this card in the existing stats grid on the dashboard.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 16,
      "title": "My Fleet top summary bar",
      "portal": "fleet",
      "area": "ux",
      "description": "Add a summary bar at the top of the My Fleet page showing active / inactive / unassigned vehicle counts at a glance.",
      "files": ["src/app/(fleet)/fleet/vehicles/page.tsx"],
      "prompt_hint": "After the page header row, add a 3-column summary bar: bg-white border border-border rounded-2xl p-4 grid grid-cols-3 gap-2 mb-4. Each column: number in font-display text-2xl (text-leaf for active, text-sub for inactive, text-gold for unassigned), label in text-[10px] text-sub uppercase. Active = vehicles.filter(v => v.active).length. Inactive = vehicles.filter(v => !v.active).length. Unassigned = vehicles.filter(v => !v.driver_id).length. Only render this bar when !loading and vehicles.length > 0.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 17,
      "title": "Earnings per vehicle breakdown table",
      "portal": "fleet",
      "area": "feature",
      "description": "Add a per-vehicle earnings breakdown table to the owner earnings page.",
      "files": ["src/app/(fleet)/fleet/earnings/page.tsx"],
      "prompt_hint": "Group the existing bookings data by ride_id vehicle. The bookings from /api/fleet/earnings already contain Ride data. Group by ride vehicle (you'll need to cross-reference with vehicle data if available, or group by driver). Show a table below the existing payouts section: 'Earnings by Trip' heading, then each booking as a row with columns: route (from_city → to_city), date (departure_time formatted), amount (₹{amount_paise/100}), status badge. Wrap in bg-white border border-border rounded-2xl overflow-hidden. Use a simple div table pattern (not an HTML table) with flex rows.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 18,
      "title": "Fleet Drivers — trips this week column",
      "portal": "fleet",
      "area": "feature",
      "description": "Add a 'trips this week' count to each driver card on the Fleet Drivers page.",
      "files": ["src/app/(fleet)/fleet/fleet-drivers/page.tsx"],
      "prompt_hint": "The driver data from /api/fleet/fleet-drivers includes Vehicle data. Add a 'Trips this week' count to each driver card. Fetch from /api/fleet/history with the driver_profile_id as a filter query param (GET /api/fleet/history?driver_profile_id={id}&days=7). Show the count as a small chip: Route icon w-3 h-3 + '{count} trips this week' in text-xs text-sub. If the fetch fails or returns 0, show '0 trips this week'. Fetch per-driver in a useEffect after drivers load.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 19,
      "title": "Owner dashboard — alert dot for unassigned drivers",
      "portal": "fleet",
      "area": "ux",
      "description": "Show an alert indicator on the owner dashboard when there are approved fleet drivers who have no assigned vehicle.",
      "files": ["src/app/(fleet)/fleet/dashboard/page.tsx"],
      "prompt_hint": "After loading dashboard data, also fetch /api/fleet/fleet-drivers. Count drivers where vehicles array is empty (no assigned vehicle). If count > 0, show an alert banner in the dashboard: bg-gold/10 border border-gold/30 rounded-2xl p-4 flex items-center gap-3. AlertCircle icon text-gold w-5 h-5. Text: '{count} driver{s} {have/has} no assigned vehicle.' in text-sm text-text. Link: 'Assign now →' text-leaf font-semibold href='/fleet/fleet-drivers'. Place this banner below the stats grid.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 20,
      "title": "Vehicle card — inline Assign Driver dropdown",
      "portal": "fleet",
      "area": "ux",
      "description": "Add an inline Assign Driver dropdown directly on vehicle cards on the My Fleet page, eliminating the need to navigate to the Fleet Drivers page to assign.",
      "files": ["src/app/(fleet)/fleet/vehicles/page.tsx"],
      "prompt_hint": "On each vehicle card where driver_id is null, add an 'Assign Driver' section below the existing card content. Fetch approved drivers from /api/fleet/fleet-drivers on page load alongside vehicles. Show a select dropdown: border border-border rounded-xl px-3 py-2 text-xs w-full. Options: 'Assign a driver…' (disabled default) + each driver's name + phone. On change, call POST /api/fleet/assign-driver with {vehicle_id, driver_profile_id}. On success: toast.success + update local vehicles state to set driver_id. On error: toast.error.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 21,
      "title": "Owner dashboard — monthly revenue trend chart",
      "portal": "fleet",
      "area": "feature",
      "description": "Add a mini monthly revenue trend chart to the owner dashboard showing earnings over the last 6 months.",
      "files": ["src/app/(fleet)/fleet/dashboard/page.tsx"],
      "prompt_hint": "Fetch /api/fleet/earnings. Group bookings by month (last 6 months). For each month compute total amount_paise. Render a CSS-only bar chart: flex items-end gap-2 h-20. Each bar: flex-1 bg-leaf/70 rounded-t-lg with height proportional to that month's revenue relative to the max (inline style). Below each bar: 3-letter month label in text-[10px] text-sub text-center. Add a 'Last 6 months' label and total in font-display text-2xl text-forest above the chart. Wrap in a bg-white border border-border rounded-2xl p-5 card.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 22,
      "title": "Admin metrics bar",
      "portal": "admin",
      "area": "feature",
      "description": "Add a key metrics bar to the top of the admin dashboard showing today's bookings, active rides, and new signups.",
      "files": ["src/app/(admin)/admin/page.tsx"],
      "prompt_hint": "Fetch /api/admin/requests (already done on this page). Additionally fetch /api/admin/applicants for new signups. Add a 3-column metrics bar at the top of the Dashboard component: bg-forest rounded-2xl p-5 grid grid-cols-3 gap-4 text-white mb-6. Column 1: today's confirmed+completed bookings count, label 'Today's Bookings' text-lime/60. Column 2: confirmed rides currently (status CONFIRMED), label 'Active Rides'. Column 3: applicants submitted today (created_at >= today), label 'New Signups'. Each metric: font-display text-3xl text-lime + text-xs label.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 23,
      "title": "Admin applicants — bulk approve/reject",
      "portal": "admin",
      "area": "feature",
      "description": "Add bulk select checkboxes and a bulk approve/reject action bar to the admin applicants page.",
      "files": ["src/app/(admin)/admin/approvals/page.tsx"],
      "prompt_hint": "Add a selectedIds: Set<string> state. Add a checkbox to each applicant card (top-left corner, w-4 h-4 accent-green-700). Add a sticky bottom action bar that appears when selectedIds.size > 0: fixed bottom-0 inset-x-0 bg-white border-t border-border px-4 py-3 flex items-center justify-between z-20. Left: '{n} selected'. Right: 'Approve All' button (bg-leaf text-white px-4 py-2 rounded-xl text-sm font-bold) and 'Reject All' button (border border-red-300 text-red-500 px-4 py-2 rounded-xl text-sm font-bold). Bulk action calls the existing single-item approve/reject API endpoint in a Promise.all loop.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 24,
      "title": "Admin drivers list — search and status filter",
      "portal": "admin",
      "area": "ux",
      "description": "Add a search input and status filter tabs to the admin drivers page.",
      "files": ["src/app/(admin)/admin/drivers/page.tsx"],
      "prompt_hint": "Add: (1) a search input above the driver list: border border-border rounded-xl px-4 py-2.5 text-sm w-full placeholder 'Search by name or phone…'. Filter the in-memory drivers array by name.toLowerCase().includes(query) || phone.includes(query). (2) Status filter tabs below the search: 'All' | 'Pending' | 'Approved' | 'Rejected' as button tabs (active: bg-leaf text-white, inactive: bg-pale text-sub) text-sm font-semibold px-4 py-2 rounded-xl. Show filtered count in each tab label: 'Approved (12)'. Both filters compose: show drivers matching BOTH search and status filter.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 25,
      "title": "Admin documents — pending count badge and verification ring",
      "portal": "admin",
      "area": "ux",
      "description": "Add a pending documents count badge to the page header and a per-driver verification progress ring.",
      "files": ["src/app/(admin)/admin/documents/page.tsx"],
      "prompt_hint": "Add: (1) A count badge next to the 'Documents' page title: bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full showing the number of documents with status PENDING. (2) For each driver group in the document list, show a verification progress ring next to their name: a small SVG circle (32×32, stroke-dasharray technique) showing verified_count/total_docs_count. Filled arc in stroke-leaf, empty arc in stroke-border. Below the ring: '{n}/{total}' in text-[10px] text-sub. This gives at-a-glance sense of how many docs are cleared per driver.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 26,
      "title": "Admin dispatch — manual dispatch button",
      "portal": "admin",
      "area": "feature",
      "description": "Add a manual dispatch button on the admin dispatch page that lets the admin force-dispatch a specific ride request to a specific driver.",
      "files": ["src/app/(admin)/admin/drivers/dispatch/page.tsx"],
      "prompt_hint": "Add a 'Manual Dispatch' button at the top of the page (bg-leaf text-white font-bold px-4 py-2.5 rounded-xl). On click, show an inline form: a select for pending ride requests (fetched from /api/admin/requests?status=PENDING), a select for approved drivers (fetched from /api/admin/drivers), and a 'Dispatch' button. On submit: POST /api/admin/dispatch with {request_id, driver_id}. On success: toast.success('Dispatched successfully') and refresh the dispatch list. On error: toast.error(json.error). Use a simple show/hide toggle for the form — no modal.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 27,
      "title": "Admin used cars — status filter and inquiry badge",
      "portal": "admin",
      "area": "ux",
      "description": "Add status filter tabs and an inquiry count badge to listing cards on the admin used cars page.",
      "files": ["src/app/(admin)/admin/used-cars/page.tsx"],
      "prompt_hint": "Add: (1) Status filter tabs: 'All' | 'Active' | 'Sold' | 'Inactive' — same tab styling as other admin filter tabs (bg-leaf active, bg-pale inactive). Filter the in-memory listings array. Show count in each tab label. (2) On each listing card, add an inquiry count badge: bg-leaf/10 text-leaf text-xs font-bold px-2 py-0.5 rounded-full '{n} inquiries' — fetch inquiry counts from /api/admin/used-cars/{id}/inquiries or use a pre-fetched count if already in the listing data. If the listing data doesn't include inquiry_count, add it to the GET fetch by including a count query.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 28,
      "title": "Cross-portal 'What's new' chip in portal headers",
      "portal": "all",
      "area": "ux",
      "description": "Add a subtle 'What's new' chip to the header of each portal showing the most recent improvement that went live.",
      "files": ["src/app/drivers/dashboard/page.tsx", "src/app/(fleet)/fleet/layout.tsx", "src/app/(admin)/admin/page.tsx"],
      "prompt_hint": "Fetch GET /api/admin/improvements (no auth needed for a public summary endpoint — add a public variant). Return the most recent completed improvement: {day, title, completed_at}. In each portal header, show a small chip: bg-leaf/10 text-leaf text-[10px] font-semibold px-2.5 py-1 rounded-full '✨ Day {n}: {title}'. On click/tap expand to show the full title. Cache in sessionStorage so it only fetches once per session. Place in the header row, right-aligned, after other header elements.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 29,
      "title": "Mobile polish pass — modals and scroll",
      "portal": "all",
      "area": "ux",
      "description": "Fix mobile UX issues: ensure all modals/sheets close on browser back button, fix overscroll on iOS, ensure tap targets are all ≥44px.",
      "files": ["src/app/(booking)/rides/page.tsx", "src/app/(booking)/confirm/page.tsx", "src/app/bookings/page.tsx"],
      "prompt_hint": "For any bottom sheets or modals that open inline (not using Radix/Vaul): add a useEffect that pushes a history entry on open (history.pushState(null, '', window.location.href)) and listens to popstate to close. Add overscroll-y-none to any full-height scroll containers. Audit all interactive buttons in these files: any with only icon children need explicit w-11 h-11 min-w-[44px] min-h-[44px] classes. Add touch-manipulation to all button elements to remove 300ms tap delay.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    },
    {
      "day": 30,
      "title": "Performance pass — lazy load and layout shift",
      "portal": "all",
      "area": "perf",
      "description": "Reduce cumulative layout shift and improve load time by lazy-loading images and adding preconnect hints.",
      "files": ["src/app/layout.tsx", "src/app/(booking)/rides/page.tsx", "src/app/(fleet)/fleet/vehicles/page.tsx"],
      "prompt_hint": "In layout.tsx <head>: add <link rel='preconnect' href='https://fonts.googleapis.com' /> and <link rel='preconnect' href='https://supabase.co' crossOrigin='' />. For any <img> tags (not Next.js Image): add loading='lazy' decoding='async'. For vehicle thumbnail images in fleet/vehicles/page.tsx: wrap in a div with a fixed aspect-square and bg-pale placeholder so the layout doesn't shift when the image loads. For ride listing cards in rides/page.tsx: add min-h-[120px] to each card so the skeleton and loaded card have the same height.",
      "status": "pending",
      "completed_at": null,
      "deployment_id": null
    }
  ]
}
```

- [ ] **Step 3: Commit**

```powershell
git add docs/improvements/backlog.json
git commit -m "feat: add 30-day improvement backlog"
```

---

## Task 4: Create scripts/lib/backlog.ts

**Files:**
- Create: `scripts/lib/backlog.ts`

- [ ] **Step 1: Create scripts/lib directory**

```powershell
New-Item -ItemType Directory -Force "scripts\lib"
```

- [ ] **Step 2: Write scripts/lib/backlog.ts**

```typescript
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

export interface BacklogItem {
  day:          number;
  title:        string;
  portal:       "rider" | "driver" | "fleet" | "admin" | "all";
  area:         "ux" | "feature" | "perf";
  description:  string;
  files:        string[];
  prompt_hint:  string;
  status:       "pending" | "in_progress" | "completed" | "rolled_back" | "skipped";
  completed_at: string | null;
  deployment_id: string | null;
}

export interface Backlog {
  items: BacklogItem[];
}

const BACKLOG_PATH = resolve(process.cwd(), "docs/improvements/backlog.json");

export function readBacklog(): Backlog {
  return JSON.parse(readFileSync(BACKLOG_PATH, "utf-8")) as Backlog;
}

export function writeBacklog(backlog: Backlog): void {
  writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + "\n");
}

export function updateBacklogItem(day: number, updates: Partial<BacklogItem>): void {
  const backlog = readBacklog();
  const idx     = backlog.items.findIndex((i) => i.day === day);
  if (idx === -1) throw new Error(`Backlog item for day ${day} not found`);
  backlog.items[idx] = { ...backlog.items[idx], ...updates };
  writeBacklog(backlog);
}

export function getNextPendingItem(backlog: Backlog, dayOverride?: number): BacklogItem | null {
  if (dayOverride) {
    return backlog.items.find((i) => i.day === dayOverride) ?? null;
  }
  return backlog.items.find((i) => i.status === "pending") ?? null;
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit scripts/lib/backlog.ts --moduleResolution node --module esnext --target esnext
```

Expected: no output (no errors)

- [ ] **Step 4: Commit**

```powershell
git add scripts/
git commit -m "feat: add scripts/lib/backlog.ts"
```

---

## Task 5: Create scripts/lib/vercel-api.ts

**Files:**
- Create: `scripts/lib/vercel-api.ts`

- [ ] **Step 1: Write scripts/lib/vercel-api.ts**

```typescript
const BASE       = "https://api.vercel.com";
const TOKEN      = process.env.VERCEL_TOKEN!;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

export interface VercelDeployment {
  uid:        string;
  url:        string;
  readyState: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  createdAt:  number;
}

async function vercelFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...opts.headers },
  });
}

export async function getLatestProductionDeployment(): Promise<VercelDeployment | null> {
  const res  = await vercelFetch(`/v13/deployments?projectId=${PROJECT_ID}&limit=1&target=production`);
  const json = await res.json() as { deployments: VercelDeployment[] };
  return json.deployments?.[0] ?? null;
}

export async function pollDeploymentReady(
  pushedAfterMs: number,
  maxWaitMs  = 600_000,
  intervalMs = 15_000,
): Promise<VercelDeployment> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const deploy = await getLatestProductionDeployment();
    if (!deploy) continue;
    if (deploy.createdAt < pushedAfterMs) continue; // stale deployment from before our push
    if (deploy.readyState === "READY" || deploy.readyState === "ERROR") return deploy;
  }
  throw new Error("Deployment timed out after 10 minutes");
}

export async function getPreviousProductionDeployment(): Promise<VercelDeployment | null> {
  const res  = await vercelFetch(`/v13/deployments?projectId=${PROJECT_ID}&limit=2&target=production`);
  const json = await res.json() as { deployments: VercelDeployment[] };
  return json.deployments?.[1] ?? null;
}

export async function rollbackToPreviousDeployment(): Promise<string> {
  const previous = await getPreviousProductionDeployment();
  if (!previous) throw new Error("No previous deployment found");
  const res = await vercelFetch(`/v9/projects/${PROJECT_ID}/rollback/${previous.uid}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel rollback failed ${res.status}: ${body}`);
  }
  return previous.uid;
}
```

- [ ] **Step 2: Commit**

```powershell
git add scripts/lib/vercel-api.ts
git commit -m "feat: add scripts/lib/vercel-api.ts"
```

---

## Task 6: Create scripts/lib/telegram.ts, smoke-test.ts, rollback.ts

**Files:**
- Create: `scripts/lib/telegram.ts`
- Create: `scripts/lib/smoke-test.ts`
- Create: `scripts/lib/rollback.ts`

- [ ] **Step 1: Write scripts/lib/telegram.ts**

```typescript
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID!;

export async function sendTelegramMessage(text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Telegram send failed:", res.status, body);
  }
}
```

- [ ] **Step 2: Write scripts/lib/smoke-test.ts**

```typescript
const CRITICAL_URLS = [
  "https://greenrides.co.in/",
  "https://greenrides.co.in/rides",
  "https://greenrides.co.in/fleet/login",
  "https://greenrides.co.in/drivers",
  "https://greenrides.co.in/admin",
];

export interface SmokeResult {
  url:    string;
  status: number;
  ok:     boolean;
}

export interface SmokeTestSummary {
  passed:  boolean;
  results: SmokeResult[];
}

export async function runSmokeTests(): Promise<SmokeTestSummary> {
  const results = await Promise.all(
    CRITICAL_URLS.map(async (url): Promise<SmokeResult> => {
      try {
        const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15_000) });
        return { url, status: res.status, ok: res.status === 200 };
      } catch (err) {
        console.error(`Smoke test failed for ${url}:`, err);
        return { url, status: 0, ok: false };
      }
    }),
  );
  return { passed: results.every((r) => r.ok), results };
}
```

- [ ] **Step 3: Write scripts/lib/rollback.ts**

```typescript
import { createClient } from "@supabase/supabase-js";
import { rollbackToPreviousDeployment } from "./vercel-api.js";
import { sendTelegramMessage } from "./telegram.js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function rollbackImprovement(
  logId:  string,
  day:    number,
  title:  string,
): Promise<void> {
  const db = getSupabase();
  console.log(`Rolling back day ${day}: ${title}`);

  let previousId = "unknown";
  try {
    previousId = await rollbackToPreviousDeployment();
    console.log(`Rolled back to deployment: ${previousId}`);
  } catch (err) {
    console.error("Vercel rollback API failed:", err);
    throw err;
  }

  await db
    .from("ImprovementLog")
    .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
    .eq("id", logId);

  await sendTelegramMessage(
    `↩️ <b>Day ${day} rolled back</b>\n\n` +
    `${title}\n\n` +
    `Previous version is live.\n` +
    `Reverted to deployment: ${previousId}`,
  );
}
```

- [ ] **Step 4: Commit**

```powershell
git add scripts/lib/
git commit -m "feat: add scripts/lib telegram, smoke-test, rollback helpers"
```

---

## Task 7: Create scripts/daily-improve.ts

**Files:**
- Create: `scripts/daily-improve.ts`

- [ ] **Step 1: Write scripts/daily-improve.ts**

This is the phase-1 script. It reads the backlog, calls Claude API, writes files, and creates the Supabase log row. The GitHub Actions workflow commits + pushes after it exits.

```typescript
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readBacklog, getNextPendingItem, updateBacklogItem } from "./lib/backlog.js";

// Paths the agent is never allowed to write
const FORBIDDEN_PREFIXES = [
  "src/app/api/",
  "src/lib/supabase",
  "proxy.ts",
  ".env",
  "package.json",
  "package-lock.json",
];

const SYSTEM_PROMPT = `You are a senior frontend engineer implementing a specific UI improvement for Green Rides — an intercity cab booking app in Odisha, India built with Next.js 16 App Router and Tailwind CSS.

Design system tokens (ALWAYS use these, never raw hex or RGB):
- Text: text-forest (dark green headings), text-leaf (green actions), text-lime (light green on dark), text-sub (muted), text-text (body), text-gold (warnings/amber)
- Backgrounds: bg-cream (page bg), bg-pale (subtle fill), bg-forest (dark header), bg-white (cards)
- Border: border-border
- Fonts: font-display for Fraunces headings, font-mono-green for monospace
- Icons: from lucide-react only. Spinner: <Loader2 className="w-4 h-4 animate-spin" />
- Toasts: import { toast } from "sonner" — use toast.success / toast.error
- Supabase: import { supabase } from "@/lib/supabase" (client-side)
- Currency: always paise in DB. Display: Math.round(amount_paise / 100). Always prefix ₹.
- Timezone: Asia/Kolkata for all date formatting

Strict rules:
1. Modify ONLY the exact files provided. Do not reference or import files not shown.
2. Do NOT add new npm packages. Use only what is already imported in the file.
3. Do NOT change API routes, Supabase query logic, or authentication flows.
4. Do NOT add console.log statements.
5. Keep changes minimal and focused on the stated improvement only.
6. Match the existing code style exactly — same indentation, naming conventions, comment style.

Output format — output ONLY these XML blocks, no explanation, no markdown, no preamble:
<file path="src/app/example/page.tsx">
[complete new file content — every line, not a partial diff]
</file>`;

function parseFileBlocks(text: string): { path: string; content: string }[] {
  const pattern = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  const files: { path: string; content: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].trim() });
  }
  return files;
}

async function main() {
  const dayOverride = process.env.DAY_OVERRIDE ? parseInt(process.env.DAY_OVERRIDE, 10) : undefined;

  const backlog = readBacklog();
  const item    = getNextPendingItem(backlog, dayOverride);

  if (!item) {
    console.log("🎉 No pending items — all 30 days complete!");
    process.exit(0);
  }

  console.log(`🚀 Day ${item.day}: ${item.title}`);

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Idempotency: skip if already ran today
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: existing } = await db
    .from("ImprovementLog")
    .select("id")
    .eq("day", item.day)
    .gte("created_at", `${todayStr}T00:00:00Z`)
    .maybeSingle();

  if (existing) {
    console.log("Already ran today — exiting");
    process.exit(0);
  }

  // Create log row
  const { data: logRow, error: logErr } = await db
    .from("ImprovementLog")
    .insert({
      day:           item.day,
      title:         item.title,
      portal:        item.portal,
      area:          item.area,
      status:        "building",
      files_changed: item.files,
    })
    .select("id")
    .single();

  if (logErr || !logRow) throw new Error(`Failed to create log row: ${logErr?.message}`);
  console.log(`Log row created: ${logRow.id}`);

  // Read source files
  const fileContents = item.files.map((filePath) => {
    const absPath = resolve(process.cwd(), filePath);
    try {
      const content = readFileSync(absPath, "utf-8");
      return `=== ${filePath} ===\n${content}`;
    } catch {
      return `=== ${filePath} ===\n(file does not exist yet — create it from scratch)`;
    }
  });

  // Call Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const userPrompt =
    `Improvement to implement:\n\n` +
    `Title: ${item.title}\n` +
    `Description: ${item.description}\n` +
    `Spec: ${item.prompt_hint}\n\n` +
    `Current file contents:\n\n${fileContents.join("\n\n")}`;

  console.log("Calling Claude API...");
  const message = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 8000,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const fileChanges  = parseFileBlocks(responseText);

  if (fileChanges.length === 0) throw new Error("Claude returned no file blocks");
  if (fileChanges.length > 5)  throw new Error(`Safety: ${fileChanges.length} files exceeds limit of 5`);

  // Safety checks
  for (const { path: p } of fileChanges) {
    if (FORBIDDEN_PREFIXES.some((prefix) => p.startsWith(prefix))) {
      throw new Error(`Safety violation: forbidden path ${p}`);
    }
  }

  // Line count safety check
  const newLines      = fileChanges.reduce((s, f) => s + f.content.split("\n").length, 0);
  const existingLines = item.files.reduce((s, fp) => {
    try { return s + readFileSync(resolve(process.cwd(), fp), "utf-8").split("\n").length; }
    catch { return s; }
  }, 0);
  const lineDiff = Math.abs(newLines - existingLines);
  if (lineDiff > 400) throw new Error(`Safety: diff of ${lineDiff} lines exceeds 400-line limit`);

  // Write files
  for (const { path: filePath, content } of fileChanges) {
    writeFileSync(resolve(process.cwd(), filePath), content + "\n");
    console.log(`  ✏️  Written: ${filePath}`);
  }

  // Update backlog item status
  updateBacklogItem(item.day, { status: "in_progress" });

  // Write metadata for the GitHub Actions commit step
  writeFileSync("/tmp/gr-day",   String(item.day));
  writeFileSync("/tmp/gr-title", item.title);
  writeFileSync("/tmp/gr-logid", logRow.id);

  console.log(`✅ Phase 1 complete. Workflow will commit + push, then run post-deploy.ts`);
}

main().catch((err) => {
  console.error("❌ daily-improve failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```powershell
git add scripts/daily-improve.ts
git commit -m "feat: add scripts/daily-improve.ts (phase 1 agent)"
```

---

## Task 8: Create scripts/post-deploy.ts

**Files:**
- Create: `scripts/post-deploy.ts`

- [ ] **Step 1: Write scripts/post-deploy.ts**

This runs after the git push. Polls Vercel, runs smoke tests, sends Telegram notification.

```typescript
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { pollDeploymentReady, rollbackToPreviousDeployment } from "./lib/vercel-api.js";
import { runSmokeTests } from "./lib/smoke-test.js";
import { sendTelegramMessage } from "./lib/telegram.js";
import { rollbackImprovement } from "./lib/rollback.js";
import { updateBacklogItem } from "./lib/backlog.js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function main() {
  const logId    = readFileSync("/tmp/gr-logid",  "utf-8").trim();
  const day      = parseInt(readFileSync("/tmp/gr-day",   "utf-8").trim(), 10);
  const title    = readFileSync("/tmp/gr-title", "utf-8").trim();
  const pushedAt = parseInt(process.env.PUSHED_AT ?? String(Date.now()), 10);

  console.log(`📡 Post-deploy: day ${day} — ${title}`);
  const db = getSupabase();

  // Poll Vercel until deploy is ready
  let deployment;
  try {
    deployment = await pollDeploymentReady(pushedAt);
  } catch (err) {
    console.error("Deploy polling timed out:", err);
    await db.from("ImprovementLog")
      .update({ status: "failed", notes: "Deployment timed out" })
      .eq("id", logId);
    await sendTelegramMessage(
      `⚠️ <b>Day ${day} — deploy timed out</b>\n\n${title}\n\nNo auto-rollback needed (deploy never completed). Will retry tomorrow.`,
    );
    process.exit(1);
  }

  if (deployment.readyState === "ERROR") {
    console.error("Deployment errored");
    await db.from("ImprovementLog")
      .update({ status: "failed", deployment_id: deployment.uid, notes: "Vercel build error" })
      .eq("id", logId);
    await sendTelegramMessage(
      `⚠️ <b>Day ${day} — build failed</b>\n\n${title}\n\nVercel build error. Check Vercel dashboard. Previous version untouched.`,
    );
    process.exit(1);
  }

  console.log(`✅ Deploy READY: ${deployment.uid}`);

  // Smoke tests
  const smoke = await runSmokeTests();
  console.log(`Smoke tests: ${smoke.results.filter((r) => r.ok).length}/${smoke.results.length} passed`);

  if (!smoke.passed) {
    const failed = smoke.results.filter((r) => !r.ok).map((r) => r.url).join(", ");
    console.error("Smoke tests failed — rolling back:", failed);
    try {
      await rollbackImprovement(logId, day, title);
    } catch (rollbackErr) {
      console.error("Rollback itself failed:", rollbackErr);
    }
    await db.from("ImprovementLog")
      .update({ status: "failed", deployment_id: deployment.uid, smoke_tests_passed: false, notes: `Smoke fail: ${failed}` })
      .eq("id", logId);
    process.exit(1);
  }

  // Success — update log
  const vetoExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await db.from("ImprovementLog").update({
    status:             "live",
    deployment_id:      deployment.uid,
    deployment_url:     `https://${deployment.url}`,
    smoke_tests_passed: true,
    veto_expires_at:    vetoExpiresAt,
  }).eq("id", logId);

  updateBacklogItem(day, { deployment_id: deployment.uid });

  // Format confirmation time (IST)
  const confirmTime = new Date(vetoExpiresAt).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
  });

  await sendTelegramMessage(
    `🟢 <b>Day ${day} live — greenrides.co.in</b>\n\n` +
    `📌 <b>${title}</b>\n\n` +
    `✅ Build passed · Smoke tests ${smoke.results.filter((r) => r.ok).length}/5\n` +
    `🔗 greenrides.co.in\n\n` +
    `Reply <b>ROLLBACK</b> within 30 min to revert.\n` +
    `Auto-confirmed at ${confirmTime} IST.`,
  );

  console.log(`🎉 Day ${day} complete and live!`);
}

main().catch((err) => {
  console.error("❌ post-deploy failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```powershell
git add scripts/post-deploy.ts
git commit -m "feat: add scripts/post-deploy.ts (phase 2 — smoke test + notify)"
```

---

## Task 9: Create .github/workflows/daily-improve.yml

**Files:**
- Create: `.github/workflows/daily-improve.yml`

- [ ] **Step 1: Create .github/workflows directory**

```powershell
New-Item -ItemType Directory -Force ".github\workflows"
```

- [ ] **Step 2: Write the workflow**

```yaml
name: Daily Improvement Agent

on:
  schedule:
    - cron: '30 2 * * *'   # 8:00 AM IST = 2:30 AM UTC
  workflow_dispatch:
    inputs:
      day_override:
        description: 'Force a specific day number (blank = auto-pick next pending)'
        required: false
        type: string

jobs:
  improve:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Phase 1 — Generate improvement
        env:
          ANTHROPIC_API_KEY:         ${{ secrets.ANTHROPIC_API_KEY }}
          NEXT_PUBLIC_SUPABASE_URL:  ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DAY_OVERRIDE:              ${{ github.event.inputs.day_override }}
        run: npx tsx scripts/daily-improve.ts

      - name: Commit and push changes
        run: |
          git config user.name "Green Rides Improvement Agent"
          git config user.email "agent@greenrides.co.in"
          git add -A
          git diff --staged --quiet || git commit -m "improve(day-$(cat /tmp/gr-day)): $(cat /tmp/gr-title)"
          git push
        env:
          PUSHED_AT_MS: ${{ steps.push.outputs.pushed_at }}

      - name: Record push timestamp
        id: push_ts
        run: echo "ts=$(date +%s)000" >> $GITHUB_OUTPUT

      - name: Phase 2 — Smoke test and notify
        env:
          NEXT_PUBLIC_SUPABASE_URL:  ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VERCEL_TOKEN:              ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID:         ${{ secrets.VERCEL_PROJECT_ID }}
          TELEGRAM_BOT_TOKEN:        ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID:          ${{ secrets.TELEGRAM_CHAT_ID }}
          PUSHED_AT:                 ${{ steps.push_ts.outputs.ts }}
        run: npx tsx scripts/post-deploy.ts
```

- [ ] **Step 3: Commit**

```powershell
git add .github/
git commit -m "feat: add GitHub Actions daily improvement workflow"
```

---

## Task 10: Add GitHub Secrets

**Files:** GitHub repository settings only (no code)

- [ ] **Step 1: Add all secrets**

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Add each:

| Secret Name | Where to find it |
|-------------|-----------------|
| `GH_PAT` | GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic) with `repo` scope |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `VERCEL_TOKEN` | vercel.com → Settings → Tokens → Create |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |
| `TELEGRAM_BOT_TOKEN` | Already configured in project. Copy from Vercel env vars. |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (send `/start` to your bot, check the webhook logs) |

- [ ] **Step 2: Test workflow manually**

Go to GitHub repo → Actions → Daily Improvement Agent → Run workflow → set `day_override` to `1` → Run. Watch the logs. Confirm:
- Claude generates file changes
- Files are committed and pushed
- Vercel deploys
- Smoke tests pass
- Telegram message arrives

---

## Task 11: Extend Telegram webhook for ROLLBACK / STATUS / SKIP

**Files:**
- Modify: `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Read the current file** (already read — see File Map section above)

- [ ] **Step 2: Replace the route with the extended version**

```typescript
// src/app/api/telegram/webhook/route.ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage, generateTelegramCode } from "@/lib/telegram";

async function handleRollback(db: ReturnType<typeof getAdminClient>, chatId: string): Promise<string> {
  const { data: log } = await db
    .from("ImprovementLog")
    .select("id, day, title, veto_expires_at, deployment_id")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return "⚠️ No live improvement found to rollback.";
  if (!log.veto_expires_at || new Date(log.veto_expires_at) < new Date()) {
    return "⏰ Veto window has closed — rollback is no longer available.";
  }

  const VERCEL_TOKEN      = process.env.VERCEL_TOKEN!;
  const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

  // Find previous deployment
  const deploysRes = await fetch(
    `https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=2&target=production`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  );
  const deploysJson = await deploysRes.json() as { deployments: { uid: string }[] };
  const previous    = deploysJson.deployments?.[1];
  if (!previous) return "⚠️ No previous deployment found.";

  const rollbackRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/rollback/${previous.uid}`,
    { method: "POST", headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  );
  if (!rollbackRes.ok) return `⚠️ Rollback API failed: ${rollbackRes.status}`;

  await db.from("ImprovementLog")
    .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
    .eq("id", log.id);

  return `↩️ <b>Day ${log.day} rolled back</b>\n\n${log.title}\n\nPrevious version is live.`;
}

async function handleStatus(db: ReturnType<typeof getAdminClient>): Promise<string> {
  const { data: log } = await db
    .from("ImprovementLog")
    .select("day, title, portal, status, deployment_url, veto_expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return "No improvements logged yet.";

  const statusEmoji: Record<string, string> = {
    building:     "🔄",
    live:         "🟢",
    completed:    "✅",
    rolled_back:  "↩️",
    failed:       "⚠️",
    skipped:      "⏭️",
  };
  const emoji = statusEmoji[log.status] ?? "❓";
  const vetoInfo = log.veto_expires_at && log.status === "live"
    ? `\nRollback available until ${new Date(log.veto_expires_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST`
    : "";

  return `${emoji} <b>Day ${log.day}</b> — ${log.status.toUpperCase()}\n\n${log.title}\nPortal: ${log.portal}${vetoInfo}`;
}

async function handleSkip(db: ReturnType<typeof getAdminClient>): Promise<string> {
  const { data: log } = await db
    .from("ImprovementLog")
    .select("id, day, title")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return "⚠️ No live improvement to skip.";

  await db.from("ImprovementLog")
    .update({ status: "skipped" })
    .eq("id", log.id);

  return `⏭️ Day ${log.day} marked as skipped.\n\n${log.title}\n\nTomorrow's improvement runs as scheduled. To re-run this day, manually set its status back to "pending" in backlog.json.`;
}

export async function POST(req: NextRequest) {
  const url    = req.nextUrl;
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
  const text   = (body.message?.text ?? "").trim().toUpperCase();

  if (!chatId) return new Response("OK", { status: 200 });

  const db = getAdminClient();

  // Improvement agent commands
  if (text === "ROLLBACK") {
    const reply = await handleRollback(db, chatId);
    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  }

  if (text === "STATUS") {
    const reply = await handleStatus(db);
    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  }

  if (text === "SKIP") {
    const reply = await handleSkip(db);
    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  }

  // Original /start handler
  if (!text.startsWith("/START")) {
    return new Response("OK", { status: 200 });
  }

  const code       = generateTelegramCode();
  const expiresAt  = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.from("TelegramCode").delete().eq("chat_id", chatId);
  await db.from("TelegramCode").insert({
    id:         crypto.randomUUID(),
    code,
    chat_id:    chatId,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  await sendTelegramMessage(
    chatId,
    `🌿 <b>Green Rides</b>\n\nYour linking code is: <b>${code}</b>\n\nEnter this in the app to link your Telegram account. Valid for 10 minutes.`,
  );

  return new Response("OK", { status: 200 });
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/telegram/webhook/route.ts
git commit -m "feat: add ROLLBACK/STATUS/SKIP handlers to telegram webhook"
```

---

## Task 12: Create confirm-improve cron route and vercel.json

**Files:**
- Create: `src/app/api/cron/confirm-improve/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write confirm-improve route**

```typescript
// src/app/api/cron/confirm-improve/route.ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  // Vercel cron requests include this header
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isInternal   = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isInternal) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db  = getAdminClient();
  const now = new Date().toISOString();

  // Find "live" rows whose veto window has expired
  const { data: expired, error } = await db
    .from("ImprovementLog")
    .select("id, day")
    .eq("status", "live")
    .lt("veto_expires_at", now);

  if (error) {
    console.error("[confirm-improve]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return Response.json({ confirmed: 0 });
  }

  const ids = expired.map((r) => r.id);

  const { error: updateErr } = await db
    .from("ImprovementLog")
    .update({ status: "completed", completed_at: now })
    .in("id", ids);

  if (updateErr) {
    console.error("[confirm-improve update]", updateErr);
    return Response.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(`[confirm-improve] Confirmed ${ids.length} improvement(s):`, expired.map((r) => r.day));
  return Response.json({ confirmed: ids.length, days: expired.map((r) => r.day) });
}
```

- [ ] **Step 2: Write vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/dispatch",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/confirm-improve",
      "schedule": "30 3 * * *"
    }
  ]
}
```

Note: Check if `/api/cron/dispatch` already has a schedule defined elsewhere (Vercel dashboard). If so, remove it from vercel.json to avoid duplication — only the confirm-improve entry is strictly required here.

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/cron/confirm-improve/ vercel.json
git commit -m "feat: add confirm-improve cron route and vercel.json schedule"
```

---

## Task 13: Create /api/admin/improvements route

**Files:**
- Create: `src/app/api/admin/improvements/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/admin/improvements/route.ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { readFileSync } from "fs";
import { resolve } from "path";

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

function readBacklogSafe() {
  try {
    const raw = readFileSync(resolve(process.cwd(), "docs/improvements/backlog.json"), "utf-8");
    return JSON.parse(raw) as { items: Array<{ day: number; title: string; portal: string; area: string; status: string }> };
  } catch {
    return { items: [] };
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();

  const [{ data: history }, { data: today }] = await Promise.all([
    db.from("ImprovementLog")
      .select("id, day, title, portal, area, status, deployment_url, smoke_tests_passed, veto_expires_at, completed_at, rolled_back_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    db.from("ImprovementLog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const backlog  = readBacklogSafe();
  const upcoming = backlog.items
    .filter((i) => i.status === "pending")
    .slice(0, 7);

  const completed = (history ?? []).filter((r) => r.status === "completed" || r.status === "rolled_back").length;

  return Response.json({
    data: {
      today:     today ?? null,
      history:   history ?? [],
      upcoming,
      completed,
      total:     30,
    },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; log_id?: string };

  if (body.action === "skip" && body.log_id) {
    const db = getAdminClient();
    const { error } = await db
      .from("ImprovementLog")
      .update({ status: "skipped" })
      .eq("id", body.log_id)
      .eq("status", "live");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data: { skipped: true }, error: null });
  }

  if (body.action === "rollback" && body.log_id) {
    const db = getAdminClient();
    const { data: log } = await db
      .from("ImprovementLog")
      .select("id, day, title, veto_expires_at")
      .eq("id", body.log_id)
      .eq("status", "live")
      .maybeSingle();

    if (!log) return Response.json({ error: "No live improvement found" }, { status: 404 });
    if (log.veto_expires_at && new Date(log.veto_expires_at) < new Date()) {
      return Response.json({ error: "Veto window has closed" }, { status: 400 });
    }

    const VERCEL_TOKEN      = process.env.VERCEL_TOKEN!;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

    const deploysRes = await fetch(
      `https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=2&target=production`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
    );
    const deploysJson = await deploysRes.json() as { deployments: { uid: string }[] };
    const previous    = deploysJson.deployments?.[1];
    if (!previous) return Response.json({ error: "No previous deployment" }, { status: 500 });

    const rollbackRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/rollback/${previous.uid}`,
      { method: "POST", headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
    );
    if (!rollbackRes.ok) return Response.json({ error: "Rollback failed" }, { status: 500 });

    await db.from("ImprovementLog")
      .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
      .eq("id", log.id);

    return Response.json({ data: { rolled_back: true }, error: null });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/app/api/admin/improvements/
git commit -m "feat: add /api/admin/improvements route"
```

---

## Task 14: Create /admin/improvements dashboard page

**Files:**
- Create: `src/app/(admin)/admin/improvements/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// src/app/(admin)/admin/improvements/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle, RotateCcw, SkipForward, ExternalLink, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface LogRow {
  id:                 string;
  day:                number;
  title:              string;
  portal:             string;
  area:               string;
  status:             string;
  deployment_url:     string | null;
  smoke_tests_passed: boolean | null;
  veto_expires_at:    string | null;
  completed_at:       string | null;
  rolled_back_at:     string | null;
  created_at:         string;
}

interface UpcomingItem {
  day:    number;
  title:  string;
  portal: string;
  area:   string;
}

interface ImprovementsData {
  today:     LogRow | null;
  history:   LogRow[];
  upcoming:  UpcomingItem[];
  completed: number;
  total:     number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  building:    { label: "Building",    className: "bg-amber-50 text-amber-600" },
  live:        { label: "Live",        className: "bg-leaf/10 text-leaf" },
  completed:   { label: "Confirmed",   className: "bg-green-50 text-green-700" },
  rolled_back: { label: "Rolled back", className: "bg-red-50 text-red-500" },
  failed:      { label: "Failed",      className: "bg-red-50 text-red-500" },
  skipped:     { label: "Skipped",     className: "bg-pale text-sub" },
};

function StatusBadge({ status }: { status: string }) {
  const { label, className } = STATUS_BADGE[status] ?? { label: status, className: "bg-pale text-sub" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}

function ImprovementsDashboard({ token }: { token: string }) {
  const [data, setData]       = useState<ImprovementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  const headers = { "x-admin-token": token };

  function load() {
    setLoading(true);
    fetch("/api/admin/improvements", { headers })
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data); else toast.error(j.error); })
      .catch(() => toast.error("Failed to load improvements"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function doAction(action: "rollback" | "skip") {
    if (!data?.today) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/improvements", {
        method:  "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body:    JSON.stringify({ action, log_id: data.today.id }),
      });
      const j = await res.json();
      if (j.error) { toast.error(j.error); return; }
      toast.success(action === "rollback" ? "Rolled back successfully" : "Day skipped");
      load();
    } catch { toast.error("Action failed"); }
    finally { setActing(false); }
  }

  const vetoOpen = data?.today?.status === "live"
    && data.today.veto_expires_at
    && new Date(data.today.veto_expires_at) > new Date();

  const pct = data ? Math.round((data.completed / data.total) * 100) : 0;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-forest">Improvement Engine</h1>
          <p className="text-sm text-sub mt-0.5">30-day autonomous product improvement</p>
        </div>
        <div className="flex items-center gap-2 bg-pale rounded-full px-4 py-2">
          <TrendingUp className="w-4 h-4 text-leaf" />
          <span className="text-sm font-bold text-forest">Day {data?.completed ?? 0} of {data?.total ?? 30}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-sub mb-1.5">
          <span>{data?.completed ?? 0} improvements shipped</span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-2.5 bg-pale rounded-full overflow-hidden">
          <div
            className="h-full bg-leaf rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Today's card */}
      {data?.today && (
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-sub font-mono-green uppercase tracking-widest mb-1">
                Day {data.today.day} — Today
              </p>
              <p className="font-semibold text-text text-base">{data.today.title}</p>
              <p className="text-xs text-sub mt-0.5 capitalize">{data.today.portal} · {data.today.area}</p>
            </div>
            <StatusBadge status={data.today.status} />
          </div>

          {data.today.smoke_tests_passed && (
            <div className="flex items-center gap-1.5 text-xs text-leaf mb-3">
              <CheckCircle className="w-3.5 h-3.5" />
              Smoke tests passed (5/5)
            </div>
          )}

          {data.today.deployment_url && (
            <a
              href={data.today.deployment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-leaf underline mb-3"
            >
              <ExternalLink className="w-3 h-3" />
              greenrides.co.in
            </a>
          )}

          {vetoOpen && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <AlertCircle className="w-4 h-4" />
                Veto window open until{" "}
                {new Date(data.today.veto_expires_at!).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
                })}{" "}
                IST
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => doAction("skip")}
                  disabled={acting}
                  className="flex items-center gap-1 text-xs text-sub border border-border px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
                >
                  <SkipForward className="w-3 h-3" /> Skip
                </button>
                <button
                  onClick={() => doAction("rollback")}
                  disabled={acting}
                  className="flex items-center gap-1 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
                >
                  {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Rollback
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History table */}
      {(data?.history ?? []).length > 1 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-text text-sm">History</h2>
          </div>
          {(data?.history ?? []).slice(1).map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0">
              <span className="text-xs font-mono-green text-sub w-10 flex-shrink-0">D{row.day}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{row.title}</p>
                <p className="text-[10px] text-sub capitalize">{row.portal} · {fmt(row.created_at)}</p>
              </div>
              <StatusBadge status={row.status} />
              {row.deployment_url && (
                <a href={row.deployment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 text-sub hover:text-leaf" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upcoming */}
      {(data?.upcoming ?? []).length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-text text-sm">Upcoming</h2>
          </div>
          {(data?.upcoming ?? []).map((item) => (
            <div key={item.day} className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0">
              <span className="text-xs font-mono-green text-sub w-10 flex-shrink-0">D{item.day}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{item.title}</p>
                <p className="text-[10px] text-sub capitalize">{item.portal} · {item.area}</p>
              </div>
              <span className="text-[10px] text-sub bg-pale px-2 py-0.5 rounded-full">Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImprovementsPage() {
  return <AdminGate>{(token: string) => <ImprovementsDashboard token={token} />}</AdminGate>;
}
```

`AdminGate` uses a render-prop pattern (confirmed from `src/app/(admin)/admin/page.tsx` line 184).

- [ ] **Step 3: Commit**

```powershell
git add src/app/(admin)/admin/improvements/
git commit -m "feat: add /admin/improvements dashboard page"
```

---

## Task 15: End-to-end test

**Files:** none (manual verification)

- [ ] **Step 1: Test the admin dashboard**

Navigate to `https://greenrides.co.in/admin/improvements`. Confirm:
- Page loads without errors
- Progress bar shows correct count
- History and upcoming sections render

- [ ] **Step 2: Test manual workflow dispatch (Day 1)**

On GitHub: Actions → Daily Improvement Agent → Run workflow → `day_override: 1`. Watch logs. Confirm:
1. Phase 1 runs, Claude generates files, files committed and pushed
2. Vercel deploys (check Vercel dashboard)
3. Phase 2 runs, smoke tests pass
4. Telegram message arrives with Day 1 details

- [ ] **Step 3: Test ROLLBACK command**

Within 30 minutes of the test deploy: reply `ROLLBACK` to the Telegram bot. Confirm:
- Vercel reverts to previous deployment
- ImprovementLog row updated to `rolled_back`
- Telegram confirms rollback

- [ ] **Step 4: Test STATUS and SKIP commands**

Run another test deploy (day_override: 2). Reply `STATUS` → confirm current day/status returned. Reply `SKIP` → confirm day marked skipped, admin dashboard updated.

- [ ] **Step 5: Verify admin dashboard reflects history**

After tests, `/admin/improvements` should show both test days in history with correct statuses (rolled_back, skipped).

- [ ] **Step 6: Final commit — push all remaining changes**

```powershell
git add -A
git commit -m "feat: complete improvement engine — ready for day 1"
git push
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 12 spec sections have corresponding tasks. Git setup (Task 1), Supabase schema (Task 2), backlog (Task 3), lib helpers (Tasks 4-6), daily-improve.ts (Task 7), post-deploy.ts (Task 8), GitHub Actions (Task 9), Secrets (Task 10), Telegram webhook (Task 11), confirm-improve cron (Task 12), admin API (Task 13), admin page (Task 14), e2e test (Task 15).
- [x] **No placeholders:** All code blocks are complete. No TBDs.
- [x] **Type consistency:** `BacklogItem` defined in `backlog.ts` and used consistently in `daily-improve.ts`. `VercelDeployment.uid` used in `vercel-api.ts` and `rollback.ts`. `ImprovementsData` defined and used only in the admin page.
- [x] **Safety constraints from spec:** Implemented in `daily-improve.ts` — FORBIDDEN_PREFIXES check, 5-file limit, 400-line diff limit. All match spec Section 12.
- [x] **UTC times correct:** Main cron 2:30 AM UTC = 8:00 AM IST ✓. Confirm-improve 3:30 AM UTC = 9:00 AM IST ✓.
