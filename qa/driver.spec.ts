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
