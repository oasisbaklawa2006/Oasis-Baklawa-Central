/**
 * PHASE 24H — Continue SO-118 from readiness (post PR #143 deploy).
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";
const ORDER_SO = "SO-2026-000118";

export const phase24hMetrics = {
  clicks: 0,
  typing: 0,
  pageSwitches: 0,
  errors: [] as string[],
  consoleErrors: [] as string[],
  stages: [] as { stage: string; ctaBefore: string; ctaAfter: string; result: string }[],
};

const STEPS = [
  { key: "readiness", expect: /Complete readiness review/i },
  { key: "completion", expect: /Attest completion/i },
  { key: "finalize", expect: /Finalize dispatch/i },
  { key: "reservation", expect: /Reserve stock/i },
  { key: "stock", expect: /Finalize stock/i },
];

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24hMetrics.pageSwitches += 1;
  await page.getByRole("button", { name: /^Email$/i }).click();
  phase24hMetrics.clicks += 1;
  await page.getByPlaceholder("you@business.com").fill("dispatch@oasisbaklawa.com");
  phase24hMetrics.typing += 28;
  await page.getByPlaceholder("••••••••").fill("dispatch_head");
  phase24hMetrics.typing += 12;
  await page.getByRole("button", { name: /^Login$/i }).click();
  phase24hMetrics.clicks += 1;
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
  page.on("console", (msg) => {
    if (msg.type() === "error") phase24hMetrics.consoleErrors.push(msg.text().slice(0, 500));
  });
}

async function openOrder(page: Page) {
  await page.goto(`${BASE}/admin/golden-chain-operator`, { waitUntil: "domcontentloaded" });
  phase24hMetrics.pageSwitches += 1;
  await page.getByLabel("Search orders").fill("000118");
  phase24hMetrics.typing += 6;
  await page.getByRole("button", { name: "Search", exact: true }).click();
  phase24hMetrics.clicks += 1;
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /SO-2026-000118/ }).first().click();
  phase24hMetrics.clicks += 1;
  await expect(page.getByText("SO-2026-000118")).toBeVisible({ timeout: 60_000 });
}

function stickyCta(page: Page) {
  return page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();
}

test.describe("PHASE 24H", () => {
  test.setTimeout(1_800_000);

  test("SO-118 readiness through stock", async ({ page }) => {
    test.skip(process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true", "mutations");

    await login(page);
    await openOrder(page);

    const initialCta = ((await stickyCta(page).textContent()) ?? "").trim();
    if (!/Complete readiness review/i.test(initialCta)) {
      phase24hMetrics.errors.push(`Expected readiness CTA, got "${initialCta}"`);
      console.log("[PHASE24H]", JSON.stringify(phase24hMetrics, null, 2));
      return;
    }

    for (const step of STEPS) {
      const cta = stickyCta(page);
      const ctaBefore = ((await cta.textContent()) ?? "").trim();

      if (!step.expect.test(ctaBefore)) {
        phase24hMetrics.stages.push({ stage: step.key, ctaBefore, ctaAfter: ctaBefore, result: "STUCK" });
        phase24hMetrics.errors.push(`${step.key}: expected ${step.expect}, got "${ctaBefore}"`);
        break;
      }

      await expect(cta).toBeEnabled({ timeout: 120_000 });
      await cta.click();
      phase24hMetrics.clicks += 1;
      await page.waitForTimeout(15_000);

      const errToast = page.locator("[data-sonner-toast]", {
        hasText: /failed|error|denied|blocked|did not advance/i,
      });
      if (await errToast.isVisible().catch(() => false)) {
        const t = (await errToast.allTextContents()).join(" | ").slice(0, 400);
        phase24hMetrics.errors.push(`toast: ${t}`);
        phase24hMetrics.stages.push({ stage: step.key, ctaBefore, ctaAfter: ctaBefore, result: "FAIL_TOAST" });
        break;
      }

      const ctaAfter = ((await stickyCta(page).textContent()) ?? "").trim();
      const advanced = ctaAfter !== ctaBefore;
      phase24hMetrics.stages.push({
        stage: step.key,
        ctaBefore,
        ctaAfter,
        result: advanced ? "PASS" : "NO_ADVANCE",
      });
      if (!advanced) {
        phase24hMetrics.errors.push(`No advance after ${step.key}`);
        break;
      }
    }

    console.log("[PHASE24H_METRICS]", JSON.stringify(phase24hMetrics, null, 2));
  });
});
