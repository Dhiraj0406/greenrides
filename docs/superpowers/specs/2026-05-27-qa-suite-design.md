# Daily QA Suite — Design Spec

## Goal

Run a Playwright end-to-end test suite against all four Green Rides portals every morning. On failure, open a GitHub Issue with screenshots and error output. On full pass, auto-close any open failure issue.

## Architecture

Four Playwright spec files (one per portal) live in `qa/` inside the main repo. A GitHub Actions workflow triggers them at 7 AM IST (01:30 UTC) via cron, and also supports `workflow_dispatch` for on-demand runs. Each spec hits the live production URL using test credentials stored as GitHub Actions secrets. The test runner uploads screenshots as artifacts and posts a GitHub Issue on failure.

**Tech stack:** Playwright 1.x · Node 20 · GitHub Actions · `actions/github-script` for issue management

---

## Portals and Flows

### Rider — `https://greenrides.co.in`

| Step | Action | Assert |
|------|--------|--------|
| 1 | Navigate to `/login` | Login page renders (phone input visible) |
| 2 | Enter phone `TEST_PHONE_RIDER`, click Get OTP | Step transitions to OTP input |
| 3 | Enter `TEST_OTP`, click Sign In | Redirected to `/` (home page) |
| 4 | Home page loaded | `Green` logo text OR `CityPicker` visible |
| 5 | Navigate to `/bookings` | No redirect to `/login`; page title or content loads |
| 6 | Navigate to `/profile` | No redirect; profile page loads |

### Driver — `https://driver.greenrides.co.in`

| Step | Action | Assert |
|------|--------|--------|
| 1 | Navigate to `/fleet/login` | Login page renders |
| 2 | Enter `TEST_PHONE_DRIVER`, click Get OTP | OTP input visible |
| 3 | Enter `TEST_OTP`, click Sign In | Redirected away from login (fleet layout visible) |
| 4 | Navigate to `/fleet/today` | Page loads without redirect |
| 5 | Navigate to `/fleet/history` | Page loads without redirect |

### Owner — `https://owner.greenrides.co.in`

| Step | Action | Assert |
|------|--------|--------|
| 1 | Navigate to `/fleet/login` | Login page renders |
| 2 | Enter `TEST_PHONE_OWNER`, click Get OTP | OTP input visible |
| 3 | Enter `TEST_OTP`, click Sign In | Redirected away from login (fleet layout visible) |
| 4 | Navigate to `/fleet/dashboard` | Stat cards or "Owner Dashboard" heading visible |
| 5 | Navigate to `/fleet/vehicles` | Page loads without redirect |
| 6 | Navigate to `/fleet/earnings` | Page loads without redirect |

### Admin — `https://admin.greenrides.co.in`

| Step | Action | Assert |
|------|--------|--------|
| 1 | Navigate to `/admin` | PIN input ("Admin Access" heading) visible |
| 2 | Enter `ADMIN_PIN`, click Enter Dashboard | Dashboard content visible (stat cards or links) |
| 3 | Navigate to `/admin/bookings` | Page loads without PIN prompt |
| 4 | Navigate to `/admin/drivers` | Page loads without PIN prompt |

---

## File Structure

```
qa/
  playwright.config.ts      # Shared config: timeout, retries, screenshot on failure
  rider.spec.ts             # Rider portal flow
  driver.spec.ts            # Driver portal flow
  owner.spec.ts             # Owner portal flow
  admin.spec.ts             # Admin portal flow

.github/workflows/
  qa.yml                    # Cron + manual trigger, runs all specs, creates/closes issues
```

No new `package.json` — Playwright is installed as a dev dependency in the root `package.json`.

---

## GitHub Actions Workflow

**File:** `.github/workflows/qa.yml`

**Triggers:**
- `schedule: '30 1 * * *'` (01:30 UTC = 07:00 IST)
- `workflow_dispatch` (manual, with optional `portal` input to run a single portal)

**Job structure:**
```
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node@v4 (node 20, npm cache)
      - npm ci
      - npx playwright install --with-deps chromium
      - npx playwright test qa/ --reporter=list,html
      - upload-artifact (playwright-report, screenshots)
      - actions/github-script → create or close issue
```

**On failure:** `actions/github-script` searches for an open issue with label `qa-fail`. If one exists, adds a comment. If none, creates a new issue titled `🔴 QA Failure — YYYY-MM-DD` with:
- Which portals failed (from `playwright-report/results.json`)
- Run URL (GitHub Actions link)
- Label: `qa-fail`, `automated`

**On full pass:** `actions/github-script` closes any open `qa-fail` issue with a comment: `✅ All portals passing as of YYYY-MM-DD HH:MM UTC.`

---

## Secrets Required

These must be added to the GitHub repo under Settings → Secrets → Actions:

| Secret name | Value |
|-------------|-------|
| `TEST_PHONE_RIDER` | `9668021577` |
| `TEST_PHONE_DRIVER` | `9000000001` |
| `TEST_PHONE_OWNER` | `9000000002` |
| `TEST_OTP` | `000000` |
| `ADMIN_PIN` | (the actual ADMIN_SECRET value from Vercel) |

---

## Error Handling

- **Playwright retries:** `retries: 1` in config — flaky network hits get one automatic retry before marking failed.
- **Screenshot on failure:** Playwright's `screenshot: 'only-on-failure'` captures the last frame of each failed test. Uploaded as artifact for 7 days.
- **Timeout:** Each test step 10 s, each full spec 60 s. Keeps the job under 10 minutes total.
- **OTP timing:** `sendOtp` call to production still goes through even when SMS is disabled (the API returns success, Supabase silently skips sending). The `verifyOtp` fast-path (`test-login` API) is used instead. No timing sensitivity.

---

## What Is NOT Tested

- Payment flows (Razorpay on hold)
- Booking confirmation end-to-end (requires a paired driver to accept)
- Admin dispatch flow (stateful, depends on existing ride requests)
- Mobile viewport edge cases (desktop Chromium only for now)

These can be added as follow-on specs once the base suite is stable.

---

## Self-Review Notes

- All five required secrets are explicitly listed — no TBDs.
- The four spec flows use selector text that matches the actual component output verified above.
- Admin uses `sessionStorage` for its token — Playwright's browser context persists it within a single spec run.
- The `qa/` directory is separate from `src/` — no impact on the Next.js build.
- The existing `deploy.yml` workflow is unaffected (different trigger, different job name).
