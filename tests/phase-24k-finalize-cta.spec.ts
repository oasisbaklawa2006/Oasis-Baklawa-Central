/**
 * PHASE 24K — Finalize CTA advances to Reserve stock (dispatched order reload).
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";
const DISPATCH_EMAIL = process.env.UAT_DISPATCH_EMAIL || "dispatch@oasisbaklawa.com";
const DISPATCH_PASSWORD = process.env.UAT_DISPATCH_PASSWORD || "dispatch_head";

async function loginDispatch(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill(DISPATCH_EMAIL);
  await page.getByPlaceholder("••••••••").fill(DISPATCH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL((url) => !/\/login(\/|$|\?)/i.test(url.pathname), { timeout: 120_000 });
}

function stickyCta(page: Page) {
  return page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();
}

test.describe("PHASE 24K finalize CTA", () => {
  test("dispatched order opens on Reserve stock", async ({ page }) => {
    const orderSo = process.env.PHASE_24K_DISPATCHED_ORDER || "SO-2026-000132";
    await loginDispatch(page);
    await page.goto(`${BASE}/admin/golden-chain-operator`, { waitUntil: "domcontentloaded" });
    const tail = orderSo.replace(/^SO-2026-/i, "");
    await page.getByLabel("Search orders").fill(tail);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: new RegExp(orderSo) }).first().click();
    await expect(stickyCta(page)).toHaveText(/Reserve stock/i, { timeout: 60_000 });
  });
});
