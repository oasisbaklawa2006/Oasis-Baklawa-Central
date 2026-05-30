import { test, expect } from "@playwright/test";
import * as path from "path";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/docs/artifacts/stage-14h";
const OVERRIDE = "Stage 14G governed stock finalization test";

test("SUPER_ADMIN finalize consumption with overrideReason", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /Email/i }).click();
  await page.locator('input[type="email"]').fill("dineshmutrejabackup@gmail.com");
  await page.locator('input[type="password"]').fill("qwerty");
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForTimeout(4000);

  await page.goto(`${BASE}/admin/stock-finalization`);
  await page.waitForTimeout(10000);
  await expect(page.getByText(/Reconciliation.*1e85/i)).toBeVisible({ timeout: 20000 });

  const overrideInput = page.locator("#stock-override-reason");
  await expect(overrideInput).toBeVisible();
  await overrideInput.fill(OVERRIDE);

  const btn = page.getByRole("button", { name: /Finalize consumption/i });
  await expect(btn).toBeEnabled();
  await btn.click();

  await expect(
    page.locator("main").getByText(/Consumption finalized — physical deduction/i),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({
    path: path.join(OUT, "01-after-finalize-success.png"),
    fullPage: true,
  });
});
