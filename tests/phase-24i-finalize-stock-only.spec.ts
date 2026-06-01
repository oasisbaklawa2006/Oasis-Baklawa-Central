/**
 * PHASE 24I — SO-118 finalize stock only (reservation already exists).
 */
import { test, expect } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";

test("SO-118 finalize stock only", async ({ page }) => {
  test.skip(process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true", "");
  test.setTimeout(300000);

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text());
  });

  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill("dispatch@oasisbaklawa.com");
  await page.getByPlaceholder("••••••••").fill("dispatch_head");
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120000 });

  await page.goto(`${BASE}/admin/golden-chain-operator`);
  await page.getByLabel("Search orders").fill("000118");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /SO-2026-000118/ }).first().click();
  await page.waitForTimeout(5000);

  const cta = page.getByRole("button", { name: /^Finalize stock$/i });
  await expect(cta).toBeVisible({ timeout: 60_000 });
  await expect(cta).toBeEnabled({ timeout: 60_000 });

  await cta.click();
  await expect(cta).toHaveText(/Working/i, { timeout: 10_000 }).catch(() => {});

  const toast = page.locator("[data-sonner-toast]");
  await toast.first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  if (await toast.count()) {
    console.log("[TOAST]", (await toast.allTextContents()).join(" | "));
  }

  await expect(page.getByRole("button", { name: /Already complete/i })).toBeVisible({
    timeout: 120_000,
  });
});
