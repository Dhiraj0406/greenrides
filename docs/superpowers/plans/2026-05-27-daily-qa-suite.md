# Daily QA Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright E2E tests for all four portals, run nightly via GitHub Actions, with auto-created GitHub Issues on failure and auto-close on pass.

**Architecture:** Four spec files in `qa/` (one per portal) share a root-level `playwright.config.ts`. A GitHub Actions cron job runs them at 07:00 IST daily, uploads a screenshot report as an artifact, and uses `actions/github-script` to manage a `qa-fail` issue. Test credentials are injected via GitHub Actions secrets and loaded locally from `.env.qa`.

**Tech Stack:** `@playwright/test` 1.x · Node 20 · GitHub Actions · `actions/github-script@v7`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `@playwright/test` devDep + `qa` script |
| `.gitignore` | Modify | Ignore `playwright-report/`, `test-results/`, `.env.qa` |
| `playwright.config.ts` | Create | Shared config: testDir, retries, screenshot on failure |
| `.env.qa` | Create (gitignored) | Local credentials for running tests against production |
| `qa/rider.spec.ts` | Create | Rider portal flow: login → home → bookings → profile |
| `qa/driver.spec.ts` | Create | Driver portal flow: login → today → history |
| `qa/owner.spec.ts` | Create | Owner portal flow: login → dashboard → vehicles → earnings |
| `qa/admin.spec.ts` | Create | Admin portal flow: PIN login → dashboard → bookings → drivers |
| `.github/workflows/qa.yml` | Create | Cron + manual trigger, issue create/close |

---

## Task 1: Playwright dependency and config

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `playwright.config.ts`
- Create: `.env.qa`

- [ ] **Step 1: Install `@playwright/test`**

```bash
npm install --save-dev @playwright/test
```

Expected: `@playwright/test` appears in `package.json` devDependencies.

- [ ] **Step 2: Add `qa` scripts to `package.json`**

In `package.json`, add to the `"scripts"` block:

```json
"qa":        "playwright test",
"qa:report": "playwright show-report playwright-report"
```

- [ ] **Step 3: Create `playwright.config.ts` at project root**

```typescript
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, ".env.qa") });

export default defineConfig({
  testDir: "./qa",
  timeout: 60_000,
  retries: 1,
  use: {
    screenshot: "only-on-failure",
    video:      "retain-on-failure",
    trace:      "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use:  { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [
    ["list"],
    ["html",  { outputFolder: "playwright-report", open: "never"         }],
    ["json",  { outputFile:   "playwright-report/results.json"           }],
  ],
});
```

- [ ] **Step 4: Create `.env.qa` (gitignored — never commit)**

```
TEST_PHONE_RIDER=9668021577
TEST_PHONE_DRIVER=9000000001
TEST_PHONE_OWNER=9000000002
TEST_OTP=000000
ADMIN_PIN=<the value of ADMIN_SECRET from Vercel env>
```

> Ask the project owner for `ADMIN_PIN`. It is the same value as the `ADMIN_SECRET` Vercel env var.

- [ ] **Step 5: Add to `.gitignore`**

Append these lines to the existing `.gitignore`:

```
# Playwright
playwright-report/
test-results/
.env.qa
```

- [ ] **Step 6: Install the Chromium browser binary**

```bash
npx playwright install --with-deps chromium
```

Expected: Chromium downloaded without errors.

- [ ] **Step 7: Verify config loads correctly**

```bash
npx playwright test --list
```

Expected output: something like `No tests found` (since `qa/` is empty). No crash.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json playwright.config.ts .gitignore
git commit -m "chore: add Playwright as dev dependency with base config"
```

---

## Task 2: Rider portal spec

**Files:**
- Create: `qa/rider.spec.ts`

**Context:** The rider portal lives at `https://greenrides.co.in`. Login flow is two pages: `/login` (phone input → "Send OTP →" button) then `/verify` (6 individual single-digit inputs that auto-submit on the 6th digit). After login the user lands on `/`.

- [ ] **Step 1: Create `qa/rider.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const BASE  = "https://greenrides.co.in";
const PHONE = process.env.TEST_PHONE_RIDER!;
const OTP   = process.env.TEST_OTP!;

test.describe("Rider portal", () => {
  test("login and access protected pages", async ({ page }) => {
    // ── Login ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`);
    await expect(page.getByText("Sign in")).toBeVisible();

    await page.getByPlaceholder("98765 43210").fill(PHONE);
    await page.getByRole("button", { name: /Send OTP/i }).click();

    // Redirected to /verify
    await page.waitForURL(/\/verify/, { timeout: 15_000 });
    await expect(page.getByText("Enter code")).toBeVisible();

    // Fill 6 individual OTP inputs (auto-submits after the 6th)
    const otpInputs = page.locator('input[type="tel"][maxlength="1"]');
    await expect(otpInputs).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(OTP[i]);
    }

    // Wait for redirect to home
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

    // ── Home page ────────────────────────────────────────────────────────
    await expect(page.getByText("Odisha Hill Routes", { exact: false })).toBeVisible();

    // ── /bookings — must not redirect to /login ──────────────────────────
    await page.goto(`${BASE}/bookings`);
    await expect(page).toHaveURL(/\/bookings/);
    await expect(page).not.toHaveURL(/\/login/);

    // ── /profile — must not redirect to /login ───────────────────────────
    await page.goto(`${BASE}/profile`);
    await expect(page).toHaveURL(/\/profile/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
```

- [ ] **Step 2: Run the rider spec against production**

```bash
npx playwright test qa/rider.spec.ts --project=chromium
```

Expected: `1 passed`. If it fails, check the screenshot in `playwright-report/` and fix the selector that doesn't match.

- [ ] **Step 3: Commit**

```bash
git add qa/rider.spec.ts
git commit -m "test(qa): add rider portal E2E spec"
```

---

## Task 3: Driver portal spec

**Files:**
- Create: `qa/driver.spec.ts`

**Context:** Driver portal lives at `https://driver.greenrides.co.in`. Login is a single-page two-step form at `/fleet/login`: phone input (placeholder "9XXXXXXXXX") → "Get OTP" → OTP input (placeholder "6-digit OTP", `type="number"`) → "Sign In". After login the URL changes away from `/fleet/login`.

- [ ] **Step 1: Create `qa/driver.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const BASE  = "https://driver.greenrides.co.in";
const PHONE = process.env.TEST_PHONE_DRIVER!;
const OTP   = process.env.TEST_OTP!;

test.describe("Driver portal", () => {
  test("login and access protected pages", async ({ page }) => {
    // ── Login ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/fleet/login`);
    await expect(page.getByText("Fleet Login")).toBeVisible();

    await page.getByPlaceholder("9XXXXXXXXX").fill(PHONE);
    await page.getByRole("button", { name: "Get OTP" }).click();

    // OTP step appears on same page
    await expect(page.getByPlaceholder("6-digit OTP")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("6-digit OTP").fill(OTP);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Redirected away from login
    await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 20_000 });

    // ── /fleet/today — must not redirect to /fleet/login ─────────────────
    await page.goto(`${BASE}/fleet/today`);
    await expect(page).not.toHaveURL(/\/fleet\/login/);

    // ── /fleet/history — must not redirect to /fleet/login ───────────────
    await page.goto(`${BASE}/fleet/history`);
    await expect(page).not.toHaveURL(/\/fleet\/login/);
  });
});
```

- [ ] **Step 2: Run the driver spec**

```bash
npx playwright test qa/driver.spec.ts --project=chromium
```

Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add qa/driver.spec.ts
git commit -m "test(qa): add driver portal E2E spec"
```

---

## Task 4: Owner portal spec

**Files:**
- Create: `qa/owner.spec.ts`

**Context:** Owner portal lives at `https://owner.greenrides.co.in`. Same fleet login flow as driver. After login, `/fleet/dashboard` shows "Owner Dashboard" heading and stat cards for vehicles/earnings.

- [ ] **Step 1: Create `qa/owner.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const BASE  = "https://owner.greenrides.co.in";
const PHONE = process.env.TEST_PHONE_OWNER!;
const OTP   = process.env.TEST_OTP!;

test.describe("Owner portal", () => {
  test("login and access protected pages", async ({ page }) => {
    // ── Login ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/fleet/login`);
    await expect(page.getByText("Fleet Login")).toBeVisible();

    await page.getByPlaceholder("9XXXXXXXXX").fill(PHONE);
    await page.getByRole("button", { name: "Get OTP" }).click();

    await expect(page.getByPlaceholder("6-digit OTP")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("6-digit OTP").fill(OTP);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 20_000 });

    // ── /fleet/dashboard — must show owner-specific content ──────────────
    await page.goto(`${BASE}/fleet/dashboard`);
    await expect(page.getByText("Owner Dashboard")).toBeVisible({ timeout: 10_000 });

    // ── /fleet/vehicles — must not redirect to login ──────────────────────
    await page.goto(`${BASE}/fleet/vehicles`);
    await expect(page).not.toHaveURL(/\/fleet\/login/);

    // ── /fleet/earnings — must not redirect to login ──────────────────────
    await page.goto(`${BASE}/fleet/earnings`);
    await expect(page).not.toHaveURL(/\/fleet\/login/);
  });
});
```

- [ ] **Step 2: Run the owner spec**

```bash
npx playwright test qa/owner.spec.ts --project=chromium
```

Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add qa/owner.spec.ts
git commit -m "test(qa): add owner portal E2E spec"
```

---

## Task 5: Admin portal spec

**Files:**
- Create: `qa/admin.spec.ts`

**Context:** Admin portal lives at `https://admin.greenrides.co.in`. Auth is PIN-based via `AdminGate` component: `/admin` shows a PIN input (placeholder "Admin PIN"), button "Enter Dashboard →". The PIN is stored in `sessionStorage` (key `green_admin_token`), which persists for the duration of the Playwright browser context — no need to re-enter for subsequent navigation within the same test.

- [ ] **Step 1: Create `qa/admin.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const BASE = "https://admin.greenrides.co.in";
const PIN  = process.env.ADMIN_PIN!;

test.describe("Admin portal", () => {
  test("PIN login and access protected pages", async ({ page }) => {
    // ── PIN login ────────────────────────────────────────────────────────
    await page.goto(`${BASE}/admin`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Admin PIN").fill(PIN);
    await page.getByRole("button", { name: /Enter Dashboard/i }).click();

    // Dashboard content loads
    await expect(page.getByText("Green Admin")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // ── /admin/bookings — must not show PIN prompt ────────────────────────
    await page.goto(`${BASE}/admin/bookings`);
    await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });

    // ── /admin/drivers — must not show PIN prompt ─────────────────────────
    await page.goto(`${BASE}/admin/drivers`);
    await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Run the admin spec**

```bash
npx playwright test qa/admin.spec.ts --project=chromium
```

Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add qa/admin.spec.ts
git commit -m "test(qa): add admin portal E2E spec"
```

---

## Task 6: Run the full suite locally

- [ ] **Step 1: Run all four specs together**

```bash
npm run qa
```

Expected: `4 passed` (one test per portal). All green.

If any test fails, open the HTML report to see the screenshot:

```bash
npm run qa:report
```

Fix the failing assertion (usually a text/selector mismatch) and re-run.

- [ ] **Step 2: Confirm `playwright-report/` is gitignored**

```bash
git status
```

Expected: `playwright-report/` does NOT appear in the output.

---

## Task 7: GitHub Actions QA workflow

**Files:**
- Create: `.github/workflows/qa.yml`

**Context:** The existing `.github/workflows/deploy.yml` uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets. The new QA workflow needs five new secrets added to the GitHub repo: `TEST_PHONE_RIDER`, `TEST_PHONE_DRIVER`, `TEST_PHONE_OWNER`, `TEST_OTP`, `ADMIN_PIN`. The workflow also needs `issues: write` permission to create and close issues. GitHub labels `qa-fail` and `automated` must exist before the first run.

- [ ] **Step 1: Create the two GitHub labels (one-time setup)**

Open the GitHub repo in the browser, go to Issues → Labels, and create:

| Name | Color | Description |
|------|-------|-------------|
| `qa-fail` | `#e11d48` (red) | Opened automatically when QA suite fails |
| `automated` | `#6b7280` (gray) | Created by GitHub Actions |

- [ ] **Step 2: Add the five GitHub Actions secrets**

Go to the GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Add:

| Secret name | Value |
|-------------|-------|
| `TEST_PHONE_RIDER` | `9668021577` |
| `TEST_PHONE_DRIVER` | `9000000001` |
| `TEST_PHONE_OWNER` | `9000000002` |
| `TEST_OTP` | `000000` |
| `ADMIN_PIN` | *(the ADMIN_SECRET value from Vercel)* |

- [ ] **Step 3: Create `.github/workflows/qa.yml`**

```yaml
name: Green Rides · Daily QA

on:
  schedule:
    - cron: '30 1 * * *'   # 07:00 IST daily
  workflow_dispatch:         # manual trigger from GitHub UI

permissions:
  contents: read
  issues:   write

jobs:
  qa:
    name: E2E QA — All Portals
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run QA suite
        id: playwright
        run: npx playwright test qa/ --reporter=list,html,json
        continue-on-error: true
        env:
          TEST_PHONE_RIDER:  ${{ secrets.TEST_PHONE_RIDER }}
          TEST_PHONE_DRIVER: ${{ secrets.TEST_PHONE_DRIVER }}
          TEST_PHONE_OWNER:  ${{ secrets.TEST_PHONE_OWNER }}
          TEST_OTP:          ${{ secrets.TEST_OTP }}
          ADMIN_PIN:         ${{ secrets.ADMIN_PIN }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ github.run_id }}
          path: playwright-report/
          retention-days: 7

      - name: Open or update failure issue
        if: steps.playwright.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            const runUrl  = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
            const date    = new Date().toISOString().slice(0, 10);
            const title   = `🔴 QA Failure — ${date}`;

            const { data: open } = await github.rest.issues.listForRepo({
              owner:  context.repo.owner,
              repo:   context.repo.repo,
              labels: 'qa-fail',
              state:  'open',
            });

            if (open.length > 0) {
              await github.rest.issues.createComment({
                owner:        context.repo.owner,
                repo:         context.repo.repo,
                issue_number: open[0].number,
                body:         `QA still failing as of ${new Date().toUTCString()}.\n[View run](${runUrl})`,
              });
            } else {
              await github.rest.issues.create({
                owner:  context.repo.owner,
                repo:   context.repo.repo,
                title,
                labels: ['qa-fail', 'automated'],
                body:   [
                  `Daily QA suite failed on ${new Date().toUTCString()}.`,
                  ``,
                  `**Run:** [${runUrl}](${runUrl})`,
                  ``,
                  `Open the run above and download the \`playwright-report\` artifact for screenshots and the full HTML report.`,
                ].join('\n'),
              });
            }

      - name: Close failure issue on full pass
        if: steps.playwright.outcome == 'success'
        uses: actions/github-script@v7
        with:
          script: |
            const { data: open } = await github.rest.issues.listForRepo({
              owner:  context.repo.owner,
              repo:   context.repo.repo,
              labels: 'qa-fail',
              state:  'open',
            });

            for (const issue of open) {
              await github.rest.issues.createComment({
                owner:        context.repo.owner,
                repo:         context.repo.repo,
                issue_number: issue.number,
                body:         `✅ All portals passing as of ${new Date().toUTCString()}.`,
              });
              await github.rest.issues.update({
                owner:        context.repo.owner,
                repo:         context.repo.repo,
                issue_number: issue.number,
                state:        'closed',
              });
            }
```

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/qa.yml
git commit -m "ci: add daily QA workflow with GitHub Issues reporting"
git push
```

- [ ] **Step 5: Trigger a manual run to verify the workflow**

On GitHub, go to Actions → "Green Rides · Daily QA" → Run workflow → Run. Wait for it to complete.

Expected: all 4 tests pass, no issue created, run appears green.

If any test fails, download the `playwright-report-*` artifact, open `index.html` in a browser, and identify the failing assertion.

---

## Self-Review

**Spec coverage check:**
- ✅ Rider: login (2-page flow) + bookings + profile
- ✅ Driver: login (single-page 2-step) + today + history
- ✅ Owner: login + dashboard heading + vehicles + earnings
- ✅ Admin: PIN login + dashboard heading + bookings + drivers
- ✅ GitHub Actions cron at 07:00 IST
- ✅ `workflow_dispatch` for manual runs
- ✅ Artifact upload (7 days retention)
- ✅ Failure: opens new issue or comments on existing
- ✅ Pass: closes open `qa-fail` issue
- ✅ All 5 secrets documented with exact names and values
- ✅ Label creation is a manual one-time step (documented)
- ✅ `.env.qa` gitignored, never committed

**Placeholder scan:** No TBDs. All code is real and complete.

**Type consistency:** No shared types — each spec is self-contained. `process.env.TEST_PHONE_RIDER!` etc. are consistent across the spec files and the workflow env block.
