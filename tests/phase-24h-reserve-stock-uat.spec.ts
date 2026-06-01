import { test, expect } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";
export const metrics = { clicks: 0, typing: 0, stages: [] as string[], errors: [] as string[] };

test("SO-118 reserve and stock after dispatched", async ({ page }) => {
  test.skip(process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true", "");
  test.setTimeout(600000);

  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill("dispatch@oasisbaklawa.com");
  await page.getByPlaceholder("••••••••").fill("dispatch_head");
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120000 });

  await page.goto(`${BASE}/admin/golden-chain-operator`);
  await page.getByLabel("Search orders").fill("000118");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /SO-2026-000118/ }).click();
  await page.waitForTimeout(3000);

  const cta = () => page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();

  for (const label of [/Reserve stock/i, /Finalize stock/i, /Already complete/i]) {
    const before = ((await cta().textContent()) ?? "").trim();
    metrics.stages.push(`before:${before}`);
    if (!label.test(before)) {
      if (/Already complete/i.test(before)) break;
      metrics.errors.push(`Expected ${label}, got ${before}`);
      break;
    }
    await cta().click();
    metrics.clicks += 1;
    await page.waitForTimeout(20_000);
    const toast = page.locator("[data-sonner-toast]");
    if (await toast.first().isVisible().catch(() => false)) {
      metrics.errors.push(`toast: ${(await toast.allTextContents()).join(" | ").slice(0, 400)}`);
    }
    const after = ((await cta().textContent()) ?? "").trim();
    metrics.stages.push(`${before} -> ${after}`);
    if (after === before) {
      metrics.errors.push(`Stuck on ${before}`);
      break;
    }
  }

  console.log("[PHASE24H_RESERVE]", JSON.stringify(metrics, null, 2));
});
