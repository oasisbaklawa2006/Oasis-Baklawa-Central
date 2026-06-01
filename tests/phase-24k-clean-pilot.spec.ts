/**
 * PHASE 24K — Clean 3-order finance-clear wizard pilot.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";
const PILOT_ORDERS = (
  process.env.PHASE_24K_PILOT_ORDERS || "SO-2026-000119,SO-2026-000120,SO-2026-000121"
).split(",");

const DISPATCH_EMAIL = process.env.UAT_DISPATCH_EMAIL || "dispatch@oasisbaklawa.com";
const DISPATCH_PASSWORD = process.env.UAT_DISPATCH_PASSWORD || "dispatch_head";
const FINANCE_EMAIL = process.env.UAT_FINANCE_EMAIL || "finance@oasisbaklawa.com";
const FINANCE_PASSWORD = process.env.UAT_FINANCE_PASSWORD || "finance_head";

export type Phase24kOrderMetrics = {
  orderSo: string;
  clicks: number;
  typing: number;
  pageSwitches: number;
  errors: string[];
  stages: { stage: string; result: string; ctaBefore?: string; ctaAfter?: string }[];
  alreadyCompleteSeen: boolean;
  finalizeAdvancedToReserve: boolean;
  startMs: number;
  endMs: number;
};

export const phase24kPilotResults: Phase24kOrderMetrics[] = [];

function click(m: { clicks: number }) {
  m.clicks += 1;
}
function typeChars(m: { typing: number }, n: number) {
  m.typing += n;
}

async function login(page: Page, email: string, password: string, m: { pageSwitches: number; clicks: number; typing: number }) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  m.pageSwitches += 1;
  await page.getByRole("button", { name: /^Email$/i }).click();
  click(m);
  await page.getByPlaceholder("you@business.com").fill(email);
  typeChars(m, email.length);
  await page.getByPlaceholder("••••••••").fill(password);
  typeChars(m, password.length);
  await page.getByRole("button", { name: /^Login$/i }).click();
  click(m);
  await page.waitForURL((url) => !/\/login(\/|$|\?)/i.test(url.pathname), { timeout: 120_000 });
}

async function selectOrder(page: Page, orderSo: string, m: { pageSwitches: number; clicks: number; typing: number }) {
  await page.goto(`${BASE}/admin/golden-chain-operator`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  m.pageSwitches += 1;
  const tail = orderSo.replace(/^SO-2026-/i, "");
  await page.getByLabel("Search orders").fill(tail);
  typeChars(m, tail.length);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  click(m);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: new RegExp(orderSo) }).first().click();
  click(m);
  await expect(page.getByText(orderSo)).toBeVisible({ timeout: 60_000 });
}

function stickyCta(page: Page) {
  return page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();
}

const STEP_PATTERNS = [
  { key: "prepare", expect: /Prepare dispatch evidence/i, role: "dispatch" as const },
  { key: "finance", expect: /Complete finance release/i, role: "finance" as const },
  { key: "readiness", expect: /Complete readiness review/i, role: "dispatch" as const },
  { key: "completion", expect: /Attest completion/i, role: "dispatch" as const },
  { key: "finalize", expect: /Finalize dispatch/i, role: "dispatch" as const },
  { key: "reservation", expect: /Reserve stock/i, role: "dispatch" as const },
  { key: "stock", expect: /Finalize stock/i, role: "dispatch" as const },
];

async function runWizardChain(page: Page, orderSo: string, metrics: Phase24kOrderMetrics) {
  let role: "dispatch" | "finance" = "dispatch";
  await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD, metrics);
  await selectOrder(page, orderSo, metrics);

  for (const step of STEP_PATTERNS) {
    if (step.role === "finance" && role !== "finance") {
      await login(page, FINANCE_EMAIL, FINANCE_PASSWORD, metrics);
      role = "finance";
      await selectOrder(page, orderSo, metrics);
    } else if (step.role === "dispatch" && role !== "dispatch") {
      await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD, metrics);
      role = "dispatch";
      await selectOrder(page, orderSo, metrics);
    }

    const cta = stickyCta(page);
    const ctaBefore = ((await cta.textContent()) ?? "").trim();

    if (/Already complete/i.test(ctaBefore)) {
      metrics.alreadyCompleteSeen = true;
      metrics.stages.push({ stage: step.key, result: "ALREADY_COMPLETE", ctaBefore });
      break;
    }

    if (!step.expect.test(ctaBefore)) {
      const skipPatterns: Record<string, RegExp> = {
        prepare: /Already recorded|Prepare|Complete finance release/i,
        finance: /Complete readiness|Attest|Finalize dispatch|Reserve stock|Finalize stock/i,
        readiness: /Attest|Finalize dispatch|Reserve stock|Finalize stock/i,
        completion: /Finalize dispatch|Reserve stock|Finalize stock/i,
        finalize: /Reserve stock|Finalize stock/i,
        reservation: /Finalize stock/i,
      };
      if (skipPatterns[step.key]?.test(ctaBefore)) {
        metrics.stages.push({ stage: step.key, result: "SKIP_ALREADY_DONE", ctaBefore });
        continue;
      }
      metrics.stages.push({ stage: step.key, result: "STUCK", ctaBefore });
      metrics.errors.push(`Expected ${step.expect}, got "${ctaBefore}"`);
      break;
    }

    await expect(cta).toBeEnabled({ timeout: 120_000 });
    await cta.click();
    click(metrics);
    if (step.key === "finalize") {
      await expect(stickyCta(page)).toHaveText(/Reserve stock/i, { timeout: 45_000 });
    } else {
      await page.waitForTimeout(12_000);
    }

    const ctaAfter = ((await stickyCta(page).textContent()) ?? "").trim();
    if (/Already complete/i.test(ctaAfter)) {
      metrics.alreadyCompleteSeen = true;
    }
    if (step.key === "finalize" && /Reserve stock/i.test(ctaAfter)) {
      metrics.finalizeAdvancedToReserve = true;
    }
    const advanced =
      ctaAfter !== ctaBefore ||
      /Already complete/i.test(ctaAfter) ||
      (step.key === "finalize" && /Reserve stock/i.test(ctaAfter));
    metrics.stages.push({
      stage: step.key,
      result: advanced ? "PASS" : "NO_ADVANCE",
      ctaBefore,
      ctaAfter,
    });
    if (!advanced) {
      metrics.errors.push(`No advance after ${step.key}`);
      break;
    }
  }
}

test.describe("PHASE 24K", () => {
  test.setTimeout(2_400_000);

  test("clean 3-order golden chain pilot", async ({ page }) => {
    test.skip(process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true", "Set ALLOW_FINANCE_E2E_MUTATIONS=true");

    for (const orderSo of PILOT_ORDERS) {
      const metrics: Phase24kOrderMetrics = {
        orderSo: orderSo.trim(),
        clicks: 0,
        typing: 0,
        pageSwitches: 0,
        errors: [],
        stages: [],
        alreadyCompleteSeen: false,
        finalizeAdvancedToReserve: false,
        startMs: Date.now(),
        endMs: 0,
      };
      await runWizardChain(page, metrics.orderSo, metrics);
      metrics.endMs = Date.now();
      phase24kPilotResults.push(metrics);
      console.log(`[PHASE24K_PILOT_${metrics.orderSo}]`, JSON.stringify(metrics, null, 2));
    }
  });
});
