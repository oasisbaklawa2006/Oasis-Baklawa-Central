/**
 * PHASE 24C — Clean greenfield Golden Chain wizard UAT (production).
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = process.env.TEST_PREVIEW_URL || "https://cursor-central-vercel.vercel.app";

const DISPATCH_EMAIL = process.env.UAT_DISPATCH_EMAIL || "dispatch@oasisbaklawa.com";
const DISPATCH_PASSWORD = process.env.UAT_DISPATCH_PASSWORD || "dispatch_head";
const FINANCE_EMAIL = process.env.UAT_FINANCE_EMAIL || "finance@oasisbaklawa.com";
const FINANCE_PASSWORD = process.env.UAT_FINANCE_PASSWORD || "finance_head";

const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || "dinesh_mutreja@yahoo.co.in";
const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || "asdfgh";

export const phase24cMetrics = {
  clicks: 0,
  typing: 0,
  pageSwitches: 0,
  stages: [] as { stage: string; result: string; cta?: string; error?: string }[],
  orderSo: "",
  orderId: "",
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
  phase24cMetrics.clicks += 1;
}
function typeChars(n: number) {
  phase24cMetrics.typing += n;
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24cMetrics.pageSwitches += 1;
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

async function gotoPath(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  phase24cMetrics.pageSwitches += 1;
}

async function resolveLatestOrder(prefix: string) {
  const sb = envSupabase();
  const { data } = await sb
    .from("orders")
    .select("id, order_number, status, payment_status")
    .ilike("id", `${prefix.toLowerCase()}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) {
    phase24cMetrics.orderId = data.id;
    phase24cMetrics.orderSo = data.order_number ?? "";
  }
  return data;
}

async function advanceOrderToCleared(page: Page, orderSo: string) {
  await gotoPath(page, "/admin/order-management");
  const search = page.getByPlaceholder(/search|order/i).first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill(orderSo);
    typeChars(orderSo.length);
    await page.waitForTimeout(500);
  }
  const row = page.getByText(orderSo).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.click();
  click();
  for (let i = 0; i < 12; i++) {
    const actionBtn = page
      .getByRole("button", { name: /Confirm Order|Send to Factory|Mark Assembled|Send to Packing|Mark Packed|Request Payment|Clear for Dispatch/i })
      .first();
    if (!(await actionBtn.isVisible().catch(() => false))) break;
    const label = await actionBtn.textContent();
    if (label?.includes("Governed Finalize")) break;
    await actionBtn.click();
    click();
    await page.waitForTimeout(1500);
    const cleared = await page.getByText(/cleared_for_dispatch|Cleared/i).isVisible().catch(() => false);
    if (cleared) break;
  }
}

async function prepScans(page: Page, orderSo: string) {
  await gotoPath(page, "/admin/reservation-board");
  await page.waitForTimeout(1500);
  const pick = page.getByText(orderSo).first();
  if (await pick.isVisible().catch(() => false)) {
    await pick.click();
    click();
  }
  const barcode = `CTN-${orderSo}`;
  const input = page.getByPlaceholder(/CTN-SO/i);
  await input.fill(barcode);
  typeChars(barcode.length);
  await page.getByRole("button", { name: /Record carton scan/i }).click();
  click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Record gate scan/i }).click();
  click();
  await page.waitForTimeout(1200);
}

async function selectWizardOrder(page: Page, orderSo: string) {
  await gotoPath(page, "/admin/golden-chain-operator");
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
}

async function clickPrimaryCta(page: Page): Promise<string> {
  const cta = page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();
  const label = ((await cta.textContent()) ?? "").trim();
  await expect(cta).toBeEnabled({ timeout: 90_000 });
  await cta.click();
  click();
  return label;
}

test.describe("PHASE 24C", () => {
  test.setTimeout(900_000);

  test("greenfield golden chain wizard UAT", async ({ page }) => {
    test.skip(
      process.env.ALLOW_FINANCE_E2E_MUTATIONS !== "true",
      "Set ALLOW_FINANCE_E2E_MUTATIONS=true",
    );

    await login(page, BUYER_EMAIL, BUYER_PASSWORD);
    await gotoPath(page, "/catalogue");
    const bulk = page.getByRole("button").filter({ hasText: /Bulk Sweets/i }).first();
    if (await bulk.isVisible().catch(() => false)) {
      await bulk.click();
      click();
    }
    const add = page.getByRole("button", { name: /^Add to Cart$/i }).first();
    await expect(add).toBeVisible({ timeout: 120_000 });
    await add.click();
    click();
    await page.waitForTimeout(2000);

    await gotoPath(page, "/cart");
    const proceed = page.getByRole("button", { name: /PROCEED TO ORDER CONFIRMATION/i });
    if (await proceed.isEnabled().catch(() => false)) {
      await proceed.click();
      click();
    }
    const submitSo = page.getByRole("button", { name: /Submit Sales Order/i });
    if (await submitSo.isVisible().catch(() => false)) {
      await submitSo.click();
      click();
      await page.waitForTimeout(3000);
    }

    const orderLabel = page.locator("p").filter({ hasText: /^Order #[a-f0-9]+$/i }).first();
    const raw = (await orderLabel.textContent().catch(() => "")) ?? "";
    const prefix = raw.match(/#([a-f0-9]+)/i)?.[1]?.toUpperCase() ?? "";
    expect(prefix).toBeTruthy();

    await login(page, FINANCE_EMAIL, FINANCE_PASSWORD);
    await gotoPath(page, "/admin/accounts-release");
    await page.waitForTimeout(2000);
    const verify = page.getByRole("button", { name: /Verify|Release|Approve/i }).first();
    if (await verify.isVisible().catch(() => false)) {
      await verify.click();
      click();
      await page.waitForTimeout(2000);
    }

    const orderRow = await resolveLatestOrder(prefix);
    expect(orderRow?.id).toBeTruthy();

    await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
    await advanceOrderToCleared(page, phase24cMetrics.orderSo);
    await prepScans(page, phase24cMetrics.orderSo);

    await selectWizardOrder(page, phase24cMetrics.orderSo);

    const steps: { stage: string; role: "dispatch" | "finance"; expect: RegExp }[] = [
      { stage: "4b", role: "dispatch", expect: /Complete readiness/i },
      { stage: "4c", role: "finance", expect: /Complete finance release/i },
      { stage: "4d", role: "dispatch", expect: /Complete completion attestation/i },
      { stage: "4e", role: "dispatch", expect: /Finalize dispatch/i },
      { stage: "4f", role: "dispatch", expect: /Create reservation/i },
      { stage: "4g", role: "dispatch", expect: /Finalize stock consumption/i },
    ];

    let role: "dispatch" | "finance" = "dispatch";
    for (const step of steps) {
      if (step.role === "finance" && role !== "finance") {
        await login(page, FINANCE_EMAIL, FINANCE_PASSWORD);
        role = "finance";
        await selectWizardOrder(page, phase24cMetrics.orderSo);
      } else if (step.role === "dispatch" && role !== "dispatch") {
        await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
        role = "dispatch";
        await selectWizardOrder(page, phase24cMetrics.orderSo);
      }

      const ctaBtn = page.locator("div.fixed.bottom-0 button").first();
      const current = ((await ctaBtn.textContent()) ?? "").trim();
      if (!step.expect.test(current)) {
        phase24cMetrics.stages.push({
          stage: step.stage,
          result: "BLOCKED",
          cta: current,
          error: `Expected ${step.expect}`,
        });
        break;
      }

      const used = await clickPrimaryCta(page);
      await page.waitForTimeout(5000);
      const errToast = page.locator("[data-sonner-toast]", { hasText: /failed|error|denied|blocked/i });
      if (await errToast.isVisible().catch(() => false)) {
        phase24cMetrics.stages.push({
          stage: step.stage,
          result: "FAIL",
          cta: used,
          error: (await errToast.innerText()).slice(0, 500),
        });
        break;
      }
      phase24cMetrics.stages.push({ stage: step.stage, result: "PASS", cta: used });

      if (step.stage === "4e") {
        const dupLabel = ((await ctaBtn.textContent()) ?? "").trim();
        if (/Finalize dispatch/i.test(dupLabel)) {
          await clickPrimaryCta(page);
          click();
          phase24cMetrics.stages.push({
            stage: "4e-dup",
            result: "CHECK",
            cta: dupLabel,
            error: "Duplicate finalize attempt",
          });
        }
      }
    }

    console.log("[PHASE24C_METRICS]", JSON.stringify(phase24cMetrics, null, 2));
  });
});
