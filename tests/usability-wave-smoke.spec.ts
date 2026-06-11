import { test, expect } from "@playwright/test";

const BASE = process.env.APP_URL || "http://127.0.0.1:5173";

const PUBLIC_ROUTES = [
  "/splash",
  "/intro",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/shipping",
  "/track",
];

/** Legacy bookmarks — should redirect, not show in-app 404 */
const GHOST_REDIRECTS: Array<{ path: string; expectNot404: boolean }> = [
  { path: "/admin/customers", expectNot404: true },
  { path: "/admin/assembly", expectNot404: true },
  { path: "/admin/finance/payments", expectNot404: true },
  { path: "/admin/finance/invoices", expectNot404: true },
  { path: "/admin/crm", expectNot404: true },
  { path: "/admin/roles", expectNot404: true },
];

const OPERATOR_ROUTES = [
  "/admin/operator-inbox",
  "/admin/whatsapp",
  "/admin/product-intelligence-prototype",
];

test.describe("Usability wave smoke", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`public route loads: ${route}`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await expect(page.locator("body")).not.toContainText("Application connection interrupted", {
        timeout: 5000,
      });
      const is404 = await page.getByRole("heading", { name: "404" }).isVisible().catch(() => false);
      expect(is404).toBe(false);
    });
  }

  for (const { path } of GHOST_REDIRECTS) {
    test(`ghost route should not 404: ${path}`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      const is404 = await page.getByRole("heading", { name: "404" }).isVisible().catch(() => false);
      expect(is404).toBe(false);
    });
  }

  for (const route of OPERATOR_ROUTES) {
    test(`operator route shell: ${route}`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
      const is404 = await page.getByRole("heading", { name: "404" }).isVisible().catch(() => false);
      expect(is404).toBe(false);
    });
  }

  test("login page renders auth form", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const hasAuthControl =
      (await page.locator("input").count()) > 0 ||
      (await page.getByRole("button").count()) > 0;
    expect(hasAuthControl).toBe(true);
  });
});
