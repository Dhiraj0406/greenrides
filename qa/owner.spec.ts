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
