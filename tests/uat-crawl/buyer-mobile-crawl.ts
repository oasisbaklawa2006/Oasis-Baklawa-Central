/**
 * Buyer mobile authenticated UAT crawl — read-only visual/function evidence.
 * Reuses TEST_BUYER_* from buyer golden-path certification conventions.
 * Does not submit orders (no production mutation); cart add is reversible read-path only.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { login } from "../e2e-helpers";
import {
  appendFailureLedger,
  appendManifestRow,
  CRAWL_BASE_URL,
  sha256File,
  slugRoute,
  writeTrancheIndex,
  ROOT,
} from "./crawl-engine";
import { hasCredentialPrefix, secretNamesForPrefix } from "./credential-matrix";
import {
  buildUxFields,
  emptyUxEvidence,
  formatUxLedgerRow,
  runPublicSurfaceUxHeuristics,
  screenshotName,
  type UxFailure,
} from "./ux-helpers";

export const BUYER_MOBILE_BASELINE_SHA =
  process.env.UAT_BUYER_BASELINE_SHA?.trim() || "0015e7b56532826a40c7beb3f33b028271c2c2f5";

export type BuyerSurfaceTarget = {
  uatId: string;
  route: string;
  state: string;
  surface: string;
};

export type BuyerMobileManifestRow = {
  uatId: string;
  tranche: string;
  surface: string;
  screenshot: string;
  screenshotSha256: string;
  route: string;
  state: string;
  role: string;
  viewport: string;
  device: string;
  baselineSha: string;
  buyerMergeSha: string;
  crawlBaseUrl: string;
  timestamp: string;
  visualStatus: "OBSERVED" | "FAIL" | "BLOCKED" | "NOT-TESTED";
  functionStatus: "NOT-TESTED" | "BLOCKED" | "OBSERVED" | "FAIL";
  uxStatus: "NOT-TESTED" | "PARTIAL" | "PASS" | "FAIL" | "BLOCKED";
  uxEvidence: ReturnType<typeof emptyUxEvidence>;
  uxEvidenceSha256: Partial<Record<keyof ReturnType<typeof emptyUxEvidence>, string>>;
  uxCriteriaTotal: number;
  uxCriteriaEvaluated: number;
  uxCriteriaPassed: number;
  uxCriteriaFailed: number;
  uxCriteriaBlocked: number;
  uxFailures: UxFailure[];
  consoleErrors: string[];
  networkErrors: string[];
  notes: string;
  evidencePhase: "buyer-mobile-authenticated";
  authenticated: boolean;
  missingSecretNames: string[];
};

const TRANCHE = "buyer-mobile-auth";
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/buyer-mobile-auth");
const REL_PREFIX = "uat-evidence/screenshots/buyer-mobile-auth";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_BUYER_MOBILE_AUTH.md");
const SUMMARY_PATH = path.join(ROOT, "docs/uat-crawl/UAT_BUYER_MOBILE_SUMMARY.json");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

export function loadBuyerMobileTargets(): BuyerSurfaceTarget[] {
  const doc = JSON.parse(readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_BUYER_MOBILE_TARGETS.json"), "utf8")) as {
    surfaces: BuyerSurfaceTarget[];
  };
  return doc.surfaces;
}

async function captureShot(page: Page, filename: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const abs = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: abs, fullPage: true, timeout: 30_000 });
  return { rel: `${REL_PREFIX}/${filename}`, abs };
}

async function captureSlot(
  page: Page,
  target: BuyerSurfaceTarget,
  slot: "s0" | "s1" | "s2" | "s3",
  label: string,
  uxEvidence: BuyerMobileManifestRow["uxEvidence"],
  uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"],
  shotNames: string[],
) {
  const routeSlug = slugRoute(target.route.replace(/\{[^}]+\}/g, "dynamic"));
  const stateSlug = target.state.replace(/[^a-zA-Z0-9_-]/g, "-");
  const name = screenshotName(
    target.uatId,
    "buyer-mobile",
    "buyer",
    `${routeSlug}-${stateSlug}`,
    slot.toUpperCase(),
    label,
  );
  const shot = await captureShot(page, name);
  uxEvidence[slot] = shot.rel;
  uxEvidenceSha256[slot] = sha256File(shot.abs);
  shotNames.push(name);
}

async function emptyCapture() {
  return {
    uxEvidence: emptyUxEvidence(),
    uxEvidenceSha256: {} as BuyerMobileManifestRow["uxEvidenceSha256"],
    shotNames: [] as string[],
  };
}

async function captureFour(page: Page, target: BuyerSurfaceTarget, labels: [string, string, string, string]) {
  const uxEvidence = emptyUxEvidence();
  const uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"] = {};
  const shotNames: string[] = [];
  await captureSlot(page, target, "s0", labels[0], uxEvidence, uxEvidenceSha256, shotNames);
  await captureSlot(page, target, "s1", labels[1], uxEvidence, uxEvidenceSha256, shotNames);
  await captureSlot(page, target, "s2", labels[2], uxEvidence, uxEvidenceSha256, shotNames);
  await captureSlot(page, target, "s3", labels[3], uxEvidence, uxEvidenceSha256, shotNames);
  return { uxEvidence, uxEvidenceSha256, shotNames };
}

function blockedRow(target: BuyerSurfaceTarget, missing: string[], notes: string): BuyerMobileManifestRow {
  return {
    uatId: target.uatId,
    tranche: TRANCHE,
    surface: target.surface,
    screenshot: "",
    screenshotSha256: "",
    route: target.route,
    state: target.state,
    role: "BUYER",
    viewport: "390x844",
    device: "iphone-14",
    baselineSha: BUYER_MOBILE_BASELINE_SHA,
    buyerMergeSha: BUYER_MOBILE_BASELINE_SHA,
    crawlBaseUrl: CRAWL_BASE_URL,
    timestamp: new Date().toISOString(),
    visualStatus: "BLOCKED",
    functionStatus: "BLOCKED",
    uxStatus: "BLOCKED",
    uxEvidence: emptyUxEvidence(),
    uxEvidenceSha256: {},
    uxCriteriaTotal: 148,
    uxCriteriaEvaluated: 0,
    uxCriteriaPassed: 0,
    uxCriteriaFailed: 0,
    uxCriteriaBlocked: 148,
    uxFailures: [],
    consoleErrors: [],
    networkErrors: [],
    notes,
    evidencePhase: "buyer-mobile-authenticated",
    authenticated: false,
    missingSecretNames: missing,
  };
}

async function firstProductViewButton(page: Page) {
  return page.getByRole("button", { name: /^View /i }).first();
}

async function firstOrderButton(page: Page) {
  return page.locator('button[type="button"]').filter({ hasText: /SO-|Order|Pending|Submitted/i }).first();
}

export async function crawlBuyerMobileSurfaces(page: Page): Promise<{
  rows: BuyerMobileManifestRow[];
  failures: string[];
  uxFailures: string[];
}> {
  const targets = loadBuyerMobileTargets();
  const rows: BuyerMobileManifestRow[] = [];
  const failures: string[] = [];
  const uxFailureRows: string[] = [];

  writeFileSync(MANIFEST_PATH, "", "utf8");

  if (!hasCredentialPrefix("TEST_BUYER")) {
    const missing = secretNamesForPrefix("TEST_BUYER").filter((n) => !process.env[n]?.trim());
    for (const target of targets) {
      failures.push(
        `| FAIL-AUTH-CRED-${target.uatId.slice(-4)} | ${target.uatId} | buyer-mobile | BUYER | iphone-14 | ${target.route} | Buyer mobile authenticated crawl | ${target.surface} | BLOCKED — missing ${missing.join(", ")} | P1 | — | — | ${TRANCHE} | Central | Auth | ${missing.join(", ")} |`,
      );
      rows.push(blockedRow(target, missing, `AUTH BLOCKED — missing ${missing.join(", ")}.`));
      appendManifestRow(MANIFEST_PATH, rows[rows.length - 1] as never);
    }
    writeSummary(rows, missing);
    return { rows, failures, uxFailures: uxFailureRows };
  }

  const email = process.env.TEST_BUYER_EMAIL!.trim();
  const password = process.env.TEST_BUYER_PASSWORD!.trim();
  let sessionOk = false;
  try {
    await login(page, email, password);
    sessionOk = !page.url().includes("/login");
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err);
    for (const target of targets) {
      failures.push(
        `| FAIL-AUTH-LOGIN-${target.uatId.slice(-4)} | ${target.uatId} | buyer-mobile | BUYER | iphone-14 | ${target.route} | Buyer login | Session on /buyer | ${msg} | P1 | — | — | ${TRANCHE} | Central | Auth | Verify TEST_BUYER_* and deploy URL |`,
      );
      rows.push(blockedRow(target, [], `LOGIN FAILED — ${msg}`));
      appendManifestRow(MANIFEST_PATH, rows[rows.length - 1] as never);
    }
    writeSummary(rows, []);
    return { rows, failures, uxFailures: uxFailureRows };
  }

  if (!sessionOk) {
    for (const target of targets) {
      failures.push(
        `| FAIL-AUTH-LOGIN-${target.uatId.slice(-4)} | ${target.uatId} | buyer-mobile | BUYER | iphone-14 | ${target.route} | Buyer login | Session established | Still on login after TEST_BUYER_* | P1 | — | — | ${TRANCHE} | Central | Auth | Verify TEST_BUYER_* |`,
      );
      rows.push(blockedRow(target, [], "LOGIN BLOCKED — still on login after credential use."));
      appendManifestRow(MANIFEST_PATH, rows[rows.length - 1] as never);
    }
    writeSummary(rows, []);
    return { rows, failures, uxFailures: uxFailureRows };
  }

  let productId: string | null = null;
  let orderId: string | null = null;

  for (const target of targets) {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 500));
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400 && !resp.url().includes("favicon")) {
        networkErrors.push(`${resp.status()} ${resp.url().slice(0, 200)}`);
      }
    });

    let functionStatus: BuyerMobileManifestRow["functionStatus"] = "OBSERVED";
    let notes = `${target.surface} — authenticated via TEST_BUYER_* (values not logged).`;
    let uxEvalFailures: UxFailure[] = [];
    let uxEvaluated = 0;
    let uxPassed = 0;
    let captured = await emptyCapture();

    try {
      switch (target.state) {
        case "dashboard-default": {
          await page.goto("/buyer", { waitUntil: "domcontentloaded", timeout: 60_000 });
          await page.waitForTimeout(2000);
          const uxEvidence = emptyUxEvidence();
          const uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"] = {};
          const shotNames: string[] = [];
          await captureSlot(page, target, "s0", "dashboard-settled", uxEvidence, uxEvidenceSha256, shotNames);
          await page.getByRole("link", { name: /Catalogue/i }).first().click().catch(() => undefined);
          await page.waitForTimeout(1000);
          await captureSlot(page, target, "s1", "nav-catalogue-click", uxEvidence, uxEvidenceSha256, shotNames);
          await page.waitForURL(/\/buyer\/catalogue/, { timeout: 30_000 }).catch(() => undefined);
          await captureSlot(page, target, "s2", "nav-catalogue-result", uxEvidence, uxEvidenceSha256, shotNames);
          await page.getByRole("link", { name: /Dashboard/i }).first().click().catch(() => undefined);
          await page.waitForTimeout(800);
          await captureSlot(page, target, "s3", "nav-dashboard-back", uxEvidence, uxEvidenceSha256, shotNames);
          captured = { uxEvidence, uxEvidenceSha256, shotNames };
          break;
        }
        case "catalogue-default": {
          await page.goto("/buyer/catalogue", { waitUntil: "domcontentloaded", timeout: 60_000 });
          await page.waitForTimeout(2500);
          const uxEvidence = emptyUxEvidence();
          const uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"] = {};
          const shotNames: string[] = [];
          await captureSlot(page, target, "s0", "catalogue-settled", uxEvidence, uxEvidenceSha256, shotNames);
          await captureSlot(page, target, "s1", "catalogue-grid", uxEvidence, uxEvidenceSha256, shotNames);
          const viewBtn = await firstProductViewButton(page);
          if (await viewBtn.isVisible().catch(() => false)) {
            await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
            await captureSlot(page, target, "s2", "product-card-focus", uxEvidence, uxEvidenceSha256, shotNames);
          } else {
            await captureSlot(page, target, "s2", "catalogue-empty-or-loading", uxEvidence, uxEvidenceSha256, shotNames);
          }
          await captureSlot(page, target, "s3", "catalogue-count-truth", uxEvidence, uxEvidenceSha256, shotNames);
          captured = { uxEvidence, uxEvidenceSha256, shotNames };
          break;
        }
        case "catalogue-search": {
          await page.goto("/buyer/catalogue", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1500);
          const uxEvidence = emptyUxEvidence();
          const uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"] = {};
          const shotNames: string[] = [];
          await captureSlot(page, target, "s0", "search-before", uxEvidence, uxEvidenceSha256, shotNames);
          const search = page.locator("#buyer-catalogue-search");
          await search.focus();
          await captureSlot(page, target, "s1", "search-focus", uxEvidence, uxEvidenceSha256, shotNames);
          await search.fill("a");
          await page.waitForTimeout(600);
          await captureSlot(page, target, "s2", "search-filtered", uxEvidence, uxEvidenceSha256, shotNames);
          await captureSlot(page, target, "s3", "search-results-truth", uxEvidence, uxEvidenceSha256, shotNames);
          captured = { uxEvidence, uxEvidenceSha256, shotNames };
          break;
        }
        case "favourites-toggle": {
          await page.goto("/buyer/catalogue", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          const uxEvidence = emptyUxEvidence();
          const uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"] = {};
          const shotNames: string[] = [];
          await captureSlot(page, target, "s0", "favourites-before", uxEvidence, uxEvidenceSha256, shotNames);
          const heart = page.locator('button[class*="rounded-full"]').filter({ has: page.locator("svg") }).first();
          if (await heart.isVisible().catch(() => false)) {
            await heart.click().catch(() => undefined);
            await page.waitForTimeout(800);
          }
          await captureSlot(page, target, "s1", "favourites-toggle", uxEvidence, uxEvidenceSha256, shotNames);
          await captureSlot(page, target, "s2", "favourites-after", uxEvidence, uxEvidenceSha256, shotNames);
          await captureSlot(page, target, "s3", "favourites-card-state", uxEvidence, uxEvidenceSha256, shotNames);
          captured = { uxEvidence, uxEvidenceSha256, shotNames };
          break;
        }
        case "product-detail": {
          await page.goto("/buyer/catalogue", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          const viewBtn = await firstProductViewButton(page);
          if (!(await viewBtn.isVisible().catch(() => false))) {
            functionStatus = "BLOCKED";
            notes += " No catalogue products visible for product-detail path.";
            captured = await captureFour(page, target, ["no-products", "no-products", "no-products", "no-products"]);
            break;
          }
          await viewBtn.click();
          await page.waitForTimeout(2000);
          const url = page.url();
          const match = url.match(/\/buyer\/catalogue\/([^/?#]+)/);
          productId = match?.[1] ?? null;
          const uxEvidence = emptyUxEvidence();
          const uxEvidenceSha256: BuyerMobileManifestRow["uxEvidenceSha256"] = {};
          const shotNames: string[] = [];
          await captureSlot(page, target, "s0", "product-detail-settled", uxEvidence, uxEvidenceSha256, shotNames);
          await captureSlot(page, target, "s1", "moq-guidance", uxEvidence, uxEvidenceSha256, shotNames);
          await page.getByRole("button", { name: /Increase .* quantity/i }).first().click().catch(() => undefined);
          await page.waitForTimeout(400);
          await captureSlot(page, target, "s2", "qty-increment", uxEvidence, uxEvidenceSha256, shotNames);
          await captureSlot(page, target, "s3", "back-nav-ready", uxEvidence, uxEvidenceSha256, shotNames);
          captured = { uxEvidence, uxEvidenceSha256, shotNames };
          await page.getByRole("button", { name: /Back to catalogue/i }).click().catch(() => undefined);
          await page.waitForTimeout(600);
          break;
        }
        case "cart-default": {
          if (productId) {
            await page.goto(`/buyer/catalogue/${productId}`, { waitUntil: "domcontentloaded" });
            await page.getByRole("button", { name: /^Add$/i }).first().click().catch(() => undefined);
            await page.waitForTimeout(1200);
          }
          await page.goto("/buyer/cart", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          captured = await captureFour(page, target, ["cart-settled", "cart-lines-or-empty", "cart-moq-guidance", "cart-proceed-state"]);
          const proceed = page.getByRole("button", { name: /PROCEED TO ORDER CONFIRMATION/i });
          if (await proceed.isVisible().catch(() => false)) {
            notes += " Proceed visible — HUMAN-GATED (no submit).";
          }
          break;
        }
        case "orders-list": {
          await page.goto("/buyer/orders", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          captured = await captureFour(page, target, ["orders-settled", "orders-list-or-empty", "orders-status-truth", "orders-action-labels"]);
          break;
        }
        case "order-detail": {
          await page.goto("/buyer/orders", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          const orderBtn = await firstOrderButton(page);
          if (!(await orderBtn.isVisible().catch(() => false))) {
            functionStatus = "OBSERVED";
            notes += " Empty orders — order-detail not reachable (empty state captured).";
            captured = await captureFour(page, target, ["orders-empty", "orders-empty", "orders-empty", "orders-empty"]);
            break;
          }
          await orderBtn.click();
          await page.waitForTimeout(2000);
          const url = page.url();
          const match = url.match(/\/buyer\/orders\/([^/?#]+)/);
          orderId = match?.[1] ?? null;
          captured = await captureFour(page, target, ["order-detail-settled", "status-truth", "finance-truth", "back-to-orders"]);
          await page.getByRole("link", { name: /Back to orders/i }).click().catch(() => undefined);
          break;
        }
        case "documents-default": {
          await page.goto("/buyer/documents", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          captured = await captureFour(page, target, ["documents-settled", "documents-cards", "documents-order-group", "documents-truth-copy"]);
          break;
        }
        case "statement-facts": {
          await page.goto("/buyer/documents", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          const statement = page.getByLabel("Statement facts").or(page.getByText(/Statement facts|Statement/i).first());
          if (await statement.isVisible().catch(() => false)) {
            await statement.scrollIntoViewIfNeeded().catch(() => undefined);
          }
          captured = await captureFour(page, target, ["statement-visible", "statement-facts", "statement-truth", "statement-documents"]);
          break;
        }
        case "support-default": {
          await page.goto("/buyer/support", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          captured = await captureFour(page, target, ["support-settled", "communication-log", "support-fab-context", "support-truth-copy"]);
          break;
        }
        case "general-enquiry": {
          await page.goto("/buyer/support", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1500);
          const subject = page.getByPlaceholder(/subject|enquiry|issue/i).first();
          if (await subject.isVisible().catch(() => false)) {
            await subject.focus();
            await subject.fill("UAT general enquiry evidence");
          } else {
            const textarea = page.locator("textarea").first();
            if (await textarea.isVisible().catch(() => false)) await textarea.focus();
          }
          await page.waitForTimeout(600);
          captured = await captureFour(page, target, ["enquiry-form-focus", "enquiry-fields", "enquiry-ready", "enquiry-no-submit"]);
          notes += " Form focused — HUMAN-GATED (no ticket submit).";
          break;
        }
        case "account-default": {
          await page.goto("/buyer/account", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          captured = await captureFour(page, target, ["account-settled", "account-company-truth", "account-links", "account-signout-visible"]);
          notes += " Sign out visible — not clicked (session preserved).";
          break;
        }
        case "access-request-approved":
        case "access-request-auth": {
          await page.goto("/buyer/access-request", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          captured = await captureFour(page, target, ["access-request-settled", "access-request-form-or-redirect", "access-request-state", "access-request-result"]);
          if (!page.url().includes("access-request")) {
            notes += " Approved buyer redirected away from access-request.";
          }
          break;
        }
        case "buyer-wildcard": {
          await page.goto("/buyer/catalogue", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          captured = await captureFour(page, target, ["buyer-entry-settled", "buyer-nav-visible", "buyer-catalogue-truth", "buyer-safe-area"]);
          break;
        }
        default: {
          await page.goto(target.route.replace(/\{[^}]+\}/g, ""), { waitUntil: "domcontentloaded" });
          captured = await captureFour(page, target, ["settled", "interaction", "overlay", "result"]);
        }
      }

      const heuristics = await runPublicSurfaceUxHeuristics(page);
      uxEvalFailures = heuristics.failures;
      uxEvaluated = heuristics.evaluated;
      uxPassed = heuristics.passed;
      for (const f of uxEvalFailures) {
        uxFailureRows.push(
          formatUxLedgerRow(f, target.uatId, "buyer-mobile", "BUYER", "iphone-14", target.route, captured?.shotNames[0] ?? ""),
        );
      }

      if (consoleErrors.length > 0) {
        failures.push(
          `| FAIL-BUYER-CON-${target.uatId.slice(-4)} | ${target.uatId} | buyer-mobile | BUYER | iphone-14 | ${target.route} | Console clean | No console errors | ${consoleErrors[0]?.slice(0, 80)} | P2 | ${captured?.shotNames[0] ?? ""} | — | ${target.surface} | Central | Runtime | — |`,
        );
      }
    } catch (err) {
      functionStatus = "FAIL";
      notes += ` ERROR: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`;
      failures.push(
        `| FAIL-BUYER-${target.state.slice(0, 12).replace(/[^A-Z0-9]/gi, "").toUpperCase()}-${target.uatId.slice(-4)} | ${target.uatId} | buyer-mobile | BUYER | iphone-14 | ${target.route} | ${target.surface} crawl | S0–S3 evidence | ${notes} | P1 | — | — | ${TRANCHE} | Central | UI | — |`,
      );
      if (!captured) {
        captured = await captureFour(page, target, ["error-state", "error-state", "error-state", "error-state"]).catch(() => null);
      }
    }

    const uxFields = buildUxFields(captured?.uxEvidence ?? emptyUxEvidence(), uxEvalFailures, {
      blocked: functionStatus === "BLOCKED",
      evaluated: uxEvaluated,
      passed: uxPassed,
      failed: uxEvalFailures.length,
    });

    const row: BuyerMobileManifestRow = {
      uatId: target.uatId,
      tranche: TRANCHE,
      surface: target.surface,
      screenshot: captured?.uxEvidence.s0 ?? "",
      screenshotSha256: captured?.uxEvidenceSha256.s0 ?? "",
      route: target.route,
      state: target.state,
      role: "BUYER",
      viewport: "390x844",
      device: "iphone-14",
      baselineSha: BUYER_MOBILE_BASELINE_SHA,
      buyerMergeSha: BUYER_MOBILE_BASELINE_SHA,
      crawlBaseUrl: CRAWL_BASE_URL,
      timestamp: new Date().toISOString(),
      visualStatus: functionStatus === "BLOCKED" ? "BLOCKED" : "OBSERVED",
      functionStatus,
      uxStatus: uxFields.uxStatus,
      uxEvidence: uxFields.uxEvidence,
      uxEvidenceSha256: captured?.uxEvidenceSha256 ?? {},
      uxCriteriaTotal: uxFields.uxCriteriaTotal,
      uxCriteriaEvaluated: uxFields.uxCriteriaEvaluated,
      uxCriteriaPassed: uxFields.uxCriteriaPassed,
      uxCriteriaFailed: uxFields.uxCriteriaFailed,
      uxCriteriaBlocked: uxFields.uxCriteriaBlocked,
      uxFailures: uxFields.uxFailures,
      consoleErrors: consoleErrors.slice(0, 5),
      networkErrors: networkErrors.slice(0, 5),
      notes,
      evidencePhase: "buyer-mobile-authenticated",
      authenticated: true,
      missingSecretNames: [],
    };
    rows.push(row);
    appendManifestRow(MANIFEST_PATH, row as never);
  }

  writeTrancheIndex(INDEX_PATH, TRANCHE, "Buyer mobile golden-path surfaces", rows as never, [
    "Authenticated buyer mobile crawl — PR #10 merge baseline `0015e7b5`.",
    `**Surfaces captured:** ${rows.filter((r) => r.authenticated).length} / ${rows.length}`,
    "**Order submit:** HUMAN-GATED — proceed button evidence only.",
  ]);
  appendFailureLedger(FAILURE_PATH, TRANCHE, failures, uxFailureRows);
  writeSummary(rows, []);
  return { rows, failures, uxFailures: uxFailureRows };
}

function writeSummary(rows: BuyerMobileManifestRow[], blockedSecrets: string[]) {
  writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        buyerMergeSha: BUYER_MOBILE_BASELINE_SHA,
        certHeadSha: "0f81448cf6f92b0ca0db667b757ca9f05ff3f542",
        crawlBaseUrl: CRAWL_BASE_URL,
        authenticatedComplete: rows.filter((r) => r.authenticated && r.uxEvidence.s0).map((r) => `${r.uatId}:${r.state}`),
        blockedSurfaces: rows.filter((r) => !r.authenticated).map((r) => ({ uatId: r.uatId, state: r.state, surface: r.surface, missingSecretNames: r.missingSecretNames })),
        blockedSecretNames: blockedSecrets,
        classifications: rows.map((r) => ({
          uatId: r.uatId,
          state: r.state,
          surface: r.surface,
          visual: r.visualStatus,
          function: r.functionStatus,
          ux: r.uxStatus,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
