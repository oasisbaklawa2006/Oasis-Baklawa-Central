/**
 * PHASE 24E — Post-24D wizard UAT on production (wizard-only, SO-2026-000026).
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = "https://cursor-central-vercel.vercel.app";
const ORDER_SO = process.env.UAT_ORDER_SO || "SO-2026-000026";

const DISPATCH_EMAIL = process.env.UAT_DISPATCH_EMAIL || "dispatch@oasisbaklawa.com";
const DISPATCH_PASSWORD = process.env.UAT_DISPATCH_PASSWORD || "dispatch_head";
const FINANCE_EMAIL = process.env.UAT_FINANCE_EMAIL || "finance@oasisbaklawa.com";
const FINANCE_PASSWORD = process.env.UAT_FINANCE_PASSWORD || "finance_head";

export const phase24eMetrics = {
  clicks: 0,
  typing: 0,
  pageSwitches: 0,
  errors: [] as string[],
  stages: [] as { stage: string; result: string; ctaBefore?: string; ctaAfter?: string; error?: string }[],
  orderSo: ORDER_SO,
  orderId: "",
  readinessEvidenceBefore: 0,
  readinessEvidenceAfter: 0,
};

function envSupabase() {
  const raw = readFileSync(".env", "utf8");
  const env = Object.fromEntries(
    raw
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
      }),
  );
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

function click() {
  phase24eMetrics.clicks += 1;
}
function typeChars(n: number) {
  phase24eMetrics.typing += n;
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24eMetrics.pageSwitches += 1;
  click();
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

async function openWizard(page: Page) {
  await page.goto(`${BASE}/admin/golden-chain-operator`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24eMetrics.pageSwitches += 1;
}

async function selectOrder(page: Page, orderSo: string) {
  await openWizard(page);
  const tail = orderSo.replace(/^SO-2026-/i, "");
  const search = page.getByLabel("Search orders");
  await search.fill(tail);
  typeChars(tail.length);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: new RegExp(orderSo) }).first().click();
  click();
  await expect(page.getByText(orderSo)).toBeVisible({ timeout: 60_000 });
}

function stickyCta(page: Page) {
  return page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();
}

async function clickPrimaryCta(page: Page): Promise<string> {
  const cta = stickyCta(page);
  const label = ((await cta.textContent()) ?? "").trim();
  await expect(cta).toBeEnabled({ timeout: 90_000 });
  await cta.click();
  click();
  return label;
}

test.describe("PHASE 24E post-fix wizard UAT", () => {
  test.setTimeout(900_000);

  test("full golden chain on SO-026", async ({ page }) => {
    test.skip(
      process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true",
      "Set ALLOW_FINANCE_E2E_MUTATIONS=true",
    );

    const sb = envSupabase();
    const { data: row } = await sb
      .from("orders")
      .select("id")
      .eq("order_number", ORDER_SO)
      .maybeSingle();
    phase24eMetrics.orderId = row?.id ?? "";

    const { count: beforeReadiness } = await sb
      .from("dispatch_readiness_evidence")
      .select("id", { count: "exact", head: true })
      .eq("order_id", phase24eMetrics.orderId);
    phase24eMetrics.readinessEvidenceBefore = beforeReadiness ?? 0;

    const steps: { stage: string; role: "dispatch" | "finance"; expect: RegExp }[] = [
      { stage: "prepare", role: "dispatch", expect: /Prepare dispatch evidence/i },
      { stage: "finance", role: "finance", expect: /Complete finance release/i },
      { stage: "readiness", role: "dispatch", expect: /Complete readiness review/i },
      { stage: "completion", role: "dispatch", expect: /Attest completion/i },
      { stage: "finalize", role: "dispatch", expect: /Finalize dispatch/i },
      { stage: "reservation", role: "dispatch", expect: /Reserve stock/i },
      { stage: "stock", role: "dispatch", expect: /Finalize stock/i },
    ];

    let role: "dispatch" | "finance" = "dispatch";
    await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
    await selectOrder(page, ORDER_SO);

    for (const step of steps) {
      if (step.role === "finance" && role !== "finance") {
        await login(page, FINANCE_EMAIL, FINANCE_PASSWORD);
        role = "finance";
        await selectOrder(page, ORDER_SO);
      } else if (step.role === "dispatch" && role !== "dispatch") {
        await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
        role = "dispatch";
        await selectOrder(page, ORDER_SO);
      }

      const ctaBefore = ((await stickyCta(page).textContent()) ?? "").trim();
      if (!step.expect.test(ctaBefore)) {
        phase24eMetrics.stages.push({
          stage: step.stage,
          result: "STUCK",
          ctaBefore,
          error: `Expected ${step.expect}`,
        });
        phase24eMetrics.errors.push(`STUCK at ${step.stage}: got "${ctaBefore}"`);
        break;
      }

      const used = await clickPrimaryCta(page);
      await page.waitForTimeout(8000);

      const errToast = page.locator("[data-sonner-toast]", {
        hasText: /failed|error|denied|blocked|did not advance/i,
      });
      if (await errToast.isVisible().catch(() => false)) {
        const errText = (await errToast.innerText()).slice(0, 500);
        phase24eMetrics.stages.push({
          stage: step.stage,
          result: "FAIL",
          ctaBefore: used,
          error: errText,
        });
        phase24eMetrics.errors.push(errText);
        break;
      }

      await page.waitForTimeout(2000);
      const ctaAfter = ((await stickyCta(page).textContent()) ?? "").trim();
      const advanced = ctaAfter !== used && ctaAfter !== ctaBefore;

      phase24eMetrics.stages.push({
        stage: step.stage,
        result: advanced || step.stage === "stock" ? "PASS" : "NO_ADVANCE",
        ctaBefore: used,
        ctaAfter,
        error: advanced ? undefined : `CTA still "${ctaAfter}" after ${used}`,
      });

      if (!advanced && step.stage !== "stock") {
        phase24eMetrics.errors.push(`No advance after ${step.stage}`);
        break;
      }
    }

    const { count: afterReadiness } = await sb
      .from("dispatch_readiness_evidence")
      .select("id", { count: "exact", head: true })
      .eq("order_id", phase24eMetrics.orderId);
    phase24eMetrics.readinessEvidenceAfter = afterReadiness ?? 0;

    console.log("[PHASE24E_METRICS]", JSON.stringify(phase24eMetrics, null, 2));
  });
});
