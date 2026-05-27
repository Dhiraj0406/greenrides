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
