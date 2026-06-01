/**
 * PHASE 24I — SO-118 reserve + stock after 24I authority fix.
 */
import { test, expect } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";
export const phase24iMetrics = { clicks: 0, typing: 0, stages: [] as string[], errors: [] as string[] };

test("SO-118 reserve and finalize stock", async ({ page }) => {
  test.skip(process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true", "");
  test.setTimeout(900000);

  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill("dispatch@oasisbaklawa.com");
  phase24iMetrics.typing += 28;
  await page.getByPlaceholder("••••••••").fill("dispatch_head");
  phase24iMetrics.typing += 12;
  await page.getByRole("button", { name: /^Login$/i }).click();
  phase24iMetrics.clicks += 2;
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120000 });

  await page.goto(`${BASE}/admin/golden-chain-operator`);
  phase24iMetrics.pageSwitches = 1;
  await page.getByLabel("Search orders").fill("000118");
  phase24iMetrics.typing += 6;
  await page.getByRole("button", { name: "Search", exact: true }).click();
  phase24iMetrics.clicks += 1;
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /SO-2026-000118/ }).first().click();
  phase24iMetrics.clicks += 1;
  await page.waitForTimeout(4000);

  const cta = () => page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();

  for (const label of [/Reserve stock/i, /Finalize stock/i, /Already complete/i]) {
    const before = ((await cta().textContent()) ?? "").trim();
    phase24iMetrics.stages.push(`before:${before}`);
    if (!label.test(before)) {
      if (/Already complete/i.test(before)) break;
      phase24iMetrics.errors.push(`Expected ${label}, got "${before}"`);
      break;
    }
    await expect(cta()).toBeEnabled({ timeout: 120000 });
    await cta().click();
    phase24iMetrics.clicks += 1;
    await page.waitForTimeout(25_000);
    const toast = page.locator("[data-sonner-toast]");
    if (await toast.first().isVisible().catch(() => false)) {
      phase24iMetrics.errors.push(`toast: ${(await toast.allTextContents()).join(" | ").slice(0, 400)}`);
    }
    const after = ((await cta().textContent()) ?? "").trim();
    phase24iMetrics.stages.push(`${before} -> ${after}`);
    if (after === before && !/Already complete/i.test(after)) {
      phase24iMetrics.errors.push(`Stuck on ${before}`);
      break;
    }
    if (/Already complete/i.test(after)) break;
  }

  console.log("[PHASE24I]", JSON.stringify(phase24iMetrics, null, 2));
});
