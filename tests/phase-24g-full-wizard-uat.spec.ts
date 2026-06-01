/**
 * PHASE 24G — Full wizard UAT after completion alignment fix.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "https://cursor-central-vercel.vercel.app";
const ORDER_SO = process.env.UAT_ORDER_SO || "SO-2026-000118";

const DISPATCH_EMAIL = process.env.UAT_DISPATCH_EMAIL || "dispatch@oasisbaklawa.com";
const DISPATCH_PASSWORD = process.env.UAT_DISPATCH_PASSWORD || "dispatch_head";
const FINANCE_EMAIL = process.env.UAT_FINANCE_EMAIL || "finance@oasisbaklawa.com";
const FINANCE_PASSWORD = process.env.UAT_FINANCE_PASSWORD || "finance_head";

export const phase24gMetrics = {
  clicks: 0,
  typing: 0,
  pageSwitches: 0,
  errors: [] as string[],
  stages: [] as { stage: string; result: string; ctaBefore?: string; ctaAfter?: string }[],
};

function click() {
  phase24gMetrics.clicks += 1;
}
function typeChars(n: number) {
  phase24gMetrics.typing += n;
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24gMetrics.pageSwitches += 1;
  await page.getByRole("button", { name: /^Email$/i }).click();
  click();
  await page.getByPlaceholder("you@business.com").fill(email);
  typeChars(email.length);
  await page.getByPlaceholder("••••••••").fill(password);
  typeChars(password.length);
  await page.getByRole("button", { name: /^Login$/i }).click();
  click();
  await page.waitForURL((url) => !/\/login(\/|$|\?)/i.test(url.pathname), { timeout: 120_000 });
}

async function selectOrder(page: Page, orderSo: string) {
  await page.goto(`${BASE}/admin/golden-chain-operator`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24gMetrics.pageSwitches += 1;
  const tail = orderSo.replace(/^SO-2026-/i, "");
  await page.getByLabel("Search orders").fill(tail);
  typeChars(tail.length);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: new RegExp(orderSo) }).first().click();
  click();
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

test.describe("PHASE 24G", () => {
  test.setTimeout(1_800_000);

  test("full wizard chain on finance-clear order", async ({ page }) => {
    test.skip(
      process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true",
      "Set ALLOW_FINANCE_E2E_MUTATIONS=true",
    );

    let role: "dispatch" | "finance" = "dispatch";
    await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
    await selectOrder(page, ORDER_SO);

    for (const step of STEP_PATTERNS) {
      if (step.role === "finance" && role !== "finance") {
        await login(page, FINANCE_EMAIL, FINANCE_PASSWORD);
        role = "finance";
        await selectOrder(page, ORDER_SO);
      } else if (step.role === "dispatch" && role !== "dispatch") {
        await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
        role = "dispatch";
        await selectOrder(page, ORDER_SO);
      }

      const cta = stickyCta(page);
      const ctaBefore = ((await cta.textContent()) ?? "").trim();

      if (!step.expect.test(ctaBefore)) {
        if (step.key === "prepare" && /Already recorded|Prepare/i.test(ctaBefore)) {
          // skip if already past prepare
        } else if (step.key === "finance" && /Complete readiness|Attest/i.test(ctaBefore)) {
          phase24gMetrics.stages.push({ stage: step.key, result: "SKIP_ALREADY_DONE", ctaBefore });
          continue;
        } else {
          phase24gMetrics.stages.push({ stage: step.key, result: "STUCK", ctaBefore });
          phase24gMetrics.errors.push(`Expected ${step.expect}, got "${ctaBefore}"`);
          break;
        }
      }

      await expect(cta).toBeEnabled({ timeout: 120_000 });
      await cta.click();
      click();
      await page.waitForTimeout(12_000);

      const ctaAfter = ((await stickyCta(page).textContent()) ?? "").trim();
      const advanced = ctaAfter !== ctaBefore;
      phase24gMetrics.stages.push({
        stage: step.key,
        result: advanced ? "PASS" : "NO_ADVANCE",
        ctaBefore,
        ctaAfter,
      });
      if (!advanced) {
        phase24gMetrics.errors.push(`No advance after ${step.key}`);
        break;
      }
    }

    console.log("[PHASE24G_METRICS]", JSON.stringify(phase24gMetrics, null, 2));
  });
});
