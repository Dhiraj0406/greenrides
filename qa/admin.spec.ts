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
