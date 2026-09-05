/**
 * Post-fix #483 buyer approval sheet re-test — UAT-0018 / UAT-0020.
 * Re-tests SAME pre-fix FAIL-481-* / FAIL-UX-481-* IDs on deploy ace340fe.
 * S0 sheet-open → S1 pricing dropdown → S2 slab + AM options → S3 enabled button (HUMAN-GATED).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { login } from "../e2e-helpers";
import {
  appendFailureLedger,
  appendManifestRow,
  CRAWL_BASE_URL,
  POST_FIX_483_BASELINE_SHA,
  ROOT,
  sha256File,
  slugRoute,
  type CrawlTarget,
  type ManifestRow,
  writeTrancheIndex,
} from "./crawl-engine";
import { getCredentials, resolveCredentials } from "./credential-matrix";
import { buildUxFields, emptyUxEvidence, screenshotName, type UxFailure } from "./ux-helpers";

export const POST_FIX_483_TARGETS: CrawlTarget[] = [
  {
    uatId: "UAT-0018",
    app: "central",
    route: "/admin/clients",
    state: "sheet-review-open",
    classification: "INTERACTIVE_STATE",
    persona: "ADMIN_SALES",
    device: "phone",
    notes: "Post-fix #483 re-test — pending fixture dc370b46",
  },
  {
    uatId: "UAT-0020",
    app: "central",
    route: "/admin/approvals",
    state: "sheet-review-open",
    classification: "INTERACTIVE_STATE",
    persona: "ADMIN_SALES",
    device: "phone",
    notes: "Post-fix #483 mirror — /admin/approvals alias",
  },
];

export const PENDING_APP_FIXTURE_ID = "dc370b46-ae39-44ec-9d1c-4c4bcdc9a60c";

export const PRE_FIX_FAIL_IDS = [
  "FAIL-481-001",
  "FAIL-481-002",
  "FAIL-UX-481-001",
  "FAIL-UX-481-002",
] as const;

export type PostFix483ManifestRow = ManifestRow & {
  evidencePhase: "post-fix-483";
  preFixEvidenceRef: string;
  postFixDeploySha: string;
  credentialPrefix: "TEST_SALES" | null;
  missingSecretNames: string[];
  authenticated: boolean;
  humanGated: boolean;
  retestFailIds: string[];
  retestDisposition: Record<string, "PASS" | "FAIL" | "BLOCKED" | "NOT-TESTED">;
};

async function captureShot(page: Page, screenshotDir: string, relPrefix: string, filename: string) {
  mkdirSync(screenshotDir, { recursive: true });
  const abs = path.join(screenshotDir, filename);
  await page.screenshot({ path: abs, fullPage: true, timeout: 30_000 });
  return { rel: `${relPrefix}/${filename}`, abs };
}

async function openPendingReviewSheet(page: Page): Promise<{ opened: boolean; note: string }> {
  const pendingTab = page.getByRole("tab", { name: /pending/i }).first();
  if (await pendingTab.isVisible().catch(() => false)) {
    await pendingTab.click().catch(() => undefined);
    await page.waitForTimeout(800);
  }

  const sheetTitle = page.locator('[data-state="open"] h2, [role="dialog"] h2').first();
  if (await sheetTitle.isVisible().catch(() => false)) {
    return { opened: true, note: "Sheet already open" };
  }

  const pendingCard = page
    .locator('button:has-text("Open details"), button:has(p:text-matches("pending","i"))')
    .first();
  if (await pendingCard.isVisible().catch(() => false)) {
    await pendingCard.click().catch(() => undefined);
    await page.waitForTimeout(1500);
  } else {
    const firstRow = page.locator("tbody tr, .space-y-3 button").first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click().catch(() => undefined);
      await page.waitForTimeout(1500);
    }
  }

  const decisionPanel = page.getByText(/decision panel/i).first();
  const opened = await decisionPanel.isVisible().catch(() => false);
  return {
    opened,
    note: opened ? "Pending review sheet opened" : "Could not open pending review sheet — no pending apps or selector miss",
  };
}

async function isSelectContentVisible(page: Page): Promise<boolean> {
  const content = page.locator('[role="listbox"], [data-radix-select-viewport]').first();
  if (!(await content.isVisible().catch(() => false))) return false;
  const box = await content.boundingBox().catch(() => null);
  if (!box || box.height < 8) return false;
  const optionCount = await page.locator('[role="option"]').count().catch(() => 0);
  return optionCount > 0;
}

async function clickPricingSlabTrigger(page: Page): Promise<boolean> {
  const byLabel = page.locator('label:has-text("Pricing Slab")').locator("..").getByRole("combobox").first();
  if (await byLabel.isVisible().catch(() => false)) {
    await byLabel.click().catch(() => undefined);
    await page.waitForTimeout(700);
    return true;
  }
  const trigger = page.getByRole("combobox").first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click().catch(() => undefined);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function selectFirstPricingSlab(page: Page): Promise<boolean> {
  const option = page.locator('[role="option"]').first();
  if (!(await option.isVisible().catch(() => false))) return false;
  await option.click().catch(() => undefined);
  await page.waitForTimeout(600);
  return true;
}

async function clickAccountManagerTrigger(page: Page): Promise<boolean> {
  const byLabel = page.locator('label:has-text("Account Manager")').locator("..").getByRole("combobox").first();
  if (await byLabel.isVisible().catch(() => false)) {
    await byLabel.click().catch(() => undefined);
    await page.waitForTimeout(700);
    return true;
  }
  const triggers = page.getByRole("combobox");
  const count = await triggers.count().catch(() => 0);
  if (count >= 2) {
    await triggers.nth(1).click().catch(() => undefined);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

function evaluateRetest(opts: {
  pricingDropdownVisible: boolean;
  managerOptionsVisible: boolean;
  approveEnabled: boolean;
  sheetOpened: boolean;
  authenticated: boolean;
}): {
  disposition: PostFix483ManifestRow["retestDisposition"];
  functionStatus: ManifestRow["functionStatus"];
  uxFailures: UxFailure[];
  ledgerRows: string[];
} {
  const disposition: PostFix483ManifestRow["retestDisposition"] = {};
  const uxFailures: UxFailure[] = [];
  const ledgerRows: string[] = [];

  if (!opts.authenticated || !opts.sheetOpened) {
    for (const id of PRE_FIX_FAIL_IDS) disposition[id] = "BLOCKED";
    return { disposition, functionStatus: "BLOCKED", uxFailures, ledgerRows };
  }

  disposition["FAIL-481-001"] = opts.pricingDropdownVisible ? "PASS" : "FAIL";
  disposition["FAIL-UX-481-001"] = opts.pricingDropdownVisible ? "PASS" : "FAIL";
  disposition["FAIL-481-002"] = opts.managerOptionsVisible ? "PASS" : "FAIL";
  disposition["FAIL-UX-481-002"] = opts.managerOptionsVisible ? "PASS" : "FAIL";

  if (!opts.pricingDropdownVisible) {
    uxFailures.push({
      failId: "FAIL-UX-481-001",
      uxRefs: "32/33/36",
      severity: "P0",
      summary: "Post-fix #483 — Pricing Slab dropdown still not visible above Sheet",
      screenshots: [],
    });
    ledgerRows.push(
      `| FAIL-481-001 | UAT-0018/0020 | central | ADMIN_SALES | phone | sheet-review-open | Pricing Slab select | Dropdown above Sheet | Still not visible post #483 ace340fe | **P0** | post-fix-483 S1 | — | Post-fix retest | Central | UI/z-index | **OPEN** — #483 regression |`,
    );
  }

  if (!opts.managerOptionsVisible) {
    uxFailures.push({
      failId: "FAIL-UX-481-002",
      uxRefs: "17/36",
      severity: "P1",
      summary: "Post-fix #483 — Account Manager options still empty or hidden",
      screenshots: [],
    });
    ledgerRows.push(
      `| FAIL-481-002 | UAT-0018/0020 | central | ADMIN_SALES | phone | sheet-review-open | Account Manager select | Managers listed | Empty/hidden post #483 ace340fe | **P1** | post-fix-483 S2 | — | Post-fix retest | Central | RBAC/query | **OPEN** — #483 regression |`,
    );
  }

  const allPass = opts.pricingDropdownVisible && opts.managerOptionsVisible && opts.approveEnabled;
  const functionStatus: ManifestRow["functionStatus"] = allPass ? "OBSERVED" : opts.pricingDropdownVisible ? "FAIL" : "FAIL";

  if (allPass) {
    ledgerRows.push(
      `| *(CLOSED)* FAIL-481-001 | UAT-0018/0020 | central | ADMIN_SALES | phone | sheet-review-open | Pricing Slab select | Dropdown above Sheet | **PASS** post #483 ace340fe | — | post-fix-483 S1 | — | Post-fix retest | Central | UI/z-index | **CLOSED** |`,
      `| *(CLOSED)* FAIL-481-002 | UAT-0018/0020 | central | ADMIN_SALES | phone | sheet-review-open | Account Manager select | Managers listed | **PASS** post #483 ace340fe | — | post-fix-483 S2 | — | Post-fix retest | Central | RBAC/query | **CLOSED** |`,
      `| *(CLOSED)* FAIL-UX-481-001 | UAT-0018/0020 | central | ADMIN_SALES | phone | sheet-review-open | UX 32/33/36 | Overlay above Sheet | **PASS** post #483 ace340fe | — | post-fix-483 S1 | — | Post-fix retest | Central | UI/UX | **CLOSED** |`,
      `| *(CLOSED)* FAIL-UX-481-002 | UAT-0018/0020 | central | ADMIN_SALES | phone | sheet-review-open | UX 17/36 | Manager options visible | **PASS** post #483 ace340fe | — | post-fix-483 S2 | — | Post-fix retest | Central | UI/UX | **CLOSED** |`,
    );
  }

  return { disposition, functionStatus, uxFailures, ledgerRows };
}

export async function crawlPostFix483Target(
  page: Page,
  target: CrawlTarget,
  opts: { screenshotDir: string; relPrefix: string; viewport: string; deviceLabel: string },
): Promise<{ row: PostFix483ManifestRow; failures: string[]; closedFailIds: string[] }> {
  const creds = resolveCredentials(target.persona, target.route);
  const failures: string[] = [];
  const routeSlug = slugRoute(target.route);
  const stateSlug = target.state.replace(/[^a-zA-Z0-9_-]/g, "-");
  const app = "central";
  const preFixRef = `uat-evidence/screenshots/tranche-02/${target.uatId}_central_admin_sales_${routeSlug}-${stateSlug}_S0-default.png (pre-fix preserved)`;

  if (!creds.wired || creds.prefix !== "TEST_SALES") {
    const missing = creds.missingSecretNames.join(", ") || "TEST_SALES_EMAIL, TEST_SALES_PASSWORD";
    failures.push(
      `| FAIL-AUTH-CRED-${target.uatId.slice(-4)} | ${target.uatId} | central | ADMIN_SALES | phone | ${target.route} [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing ${missing} | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | ${missing} |`,
    );
    const blockedDisposition = Object.fromEntries(PRE_FIX_FAIL_IDS.map((id) => [id, "BLOCKED" as const]));
    return {
      row: {
        uatId: target.uatId,
        tranche: "post-fix-483",
        screenshot: preFixRef,
        screenshotSha256: "",
        route: target.route,
        state: target.state,
        role: target.persona,
        viewport: opts.viewport,
        device: opts.deviceLabel,
        baselineSha: POST_FIX_483_BASELINE_SHA,
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
        notes: `POST-FIX #483 BLOCKED — missing ${missing}. Pre-fix tranche-02 preserved.`,
        evidencePhase: "post-fix-483",
        preFixEvidenceRef: preFixRef,
        postFixDeploySha: POST_FIX_483_BASELINE_SHA,
        credentialPrefix: null,
        missingSecretNames: creds.missingSecretNames.length ? creds.missingSecretNames : ["TEST_SALES_EMAIL", "TEST_SALES_PASSWORD"],
        authenticated: false,
        humanGated: true,
        retestFailIds: [...PRE_FIX_FAIL_IDS],
        retestDisposition: blockedDisposition,
      },
      failures,
      closedFailIds: [],
    };
  }

  const { email, password } = getCredentials("TEST_SALES");
  await login(page, email, password);
  await page.goto(target.route, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);

  const stillOnLogin = page.url().includes("/login");
  if (stillOnLogin) {
    failures.push(
      `| FAIL-AUTH-LOGIN-${target.uatId.slice(-4)} | ${target.uatId} | central | ADMIN_SALES | phone | ${target.route} | Post-fix #483 login | Session established | Still on login | P0 | pre-fix preserved | — | Post-fix #483 | Central | Auth | Verify TEST_SALES_* |`,
    );
  }

  const uxEvidence = emptyUxEvidence();
  const uxEvidenceSha256: PostFix483ManifestRow["uxEvidenceSha256"] = {};
  let pricingDropdownVisible = false;
  let managerOptionsVisible = false;
  let approveEnabled = false;
  let humanGated = true;
  let sheetNote = "";

  if (!stillOnLogin) {
    const { opened, note } = await openPendingReviewSheet(page);
    sheetNote = note;

    const s0Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S0", "sheet-open");
    const s0 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s0Name);
    uxEvidence.s0 = s0.rel;
    uxEvidenceSha256.s0 = sha256File(s0.abs);

    if (opened) {
      await clickPricingSlabTrigger(page);
      pricingDropdownVisible = await isSelectContentVisible(page);
      const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "pricing-dropdown-open");
      const s1 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s1Name);
      uxEvidence.s1 = s1.rel;
      uxEvidenceSha256.s1 = sha256File(s1.abs);

      if (pricingDropdownVisible) {
        await selectFirstPricingSlab(page);
      } else {
        await page.keyboard.press("Escape").catch(() => undefined);
      }

      await clickAccountManagerTrigger(page);
      managerOptionsVisible = await isSelectContentVisible(page);
      const s2Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S2", "slab-am-options");
      const s2 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s2Name);
      uxEvidence.s2 = s2.rel;
      uxEvidenceSha256.s2 = sha256File(s2.abs);

      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(400);

      const approveBtn = page.getByRole("button", { name: /approve & activate/i });
      approveEnabled = await approveBtn.isEnabled().catch(() => false);
      humanGated = true;
      const s3Label = approveEnabled ? "approve-enabled-human-gated" : "approve-disabled-safe-stop";
      const s3Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S3", s3Label);
      const s3 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s3Name);
      uxEvidence.s3 = s3.rel;
      uxEvidenceSha256.s3 = sha256File(s3.abs);
    } else {
      failures.push(
        `| FAIL-FIXTURE-${target.uatId.slice(-4)} | ${target.uatId} | central | ADMIN_SALES | phone | ${target.route} | Open pending sheet | Fixture ${PENDING_APP_FIXTURE_ID} or successor pending | ${note} | P0 | ${s0Name} | — | Post-fix #483 | Central | Data/Fixture | Pending app required |`,
      );
    }
  }

  const evalResult = evaluateRetest({
    pricingDropdownVisible,
    managerOptionsVisible,
    approveEnabled,
    sheetOpened: sheetNote !== "" && !sheetNote.includes("Could not"),
    authenticated: !stillOnLogin,
  });

  failures.push(...evalResult.ledgerRows);

  const uxFields = buildUxFields(uxEvidence, evalResult.uxFailures, {
    blocked: stillOnLogin || !uxEvidence.s0,
    evaluated: stillOnLogin ? 0 : 4,
    passed: evalResult.disposition["FAIL-UX-481-001"] === "PASS" ? 2 : 0,
    failed: evalResult.uxFailures.length,
    blockedCount: stillOnLogin ? 148 : 144,
  });

  const closedFailIds = PRE_FIX_FAIL_IDS.filter((id) => evalResult.disposition[id] === "PASS");

  const row: PostFix483ManifestRow = {
    uatId: target.uatId,
    tranche: "post-fix-483",
    screenshot: uxEvidence.s0 ?? preFixRef,
    screenshotSha256: uxEvidenceSha256.s0 ?? "",
    route: target.route,
    state: target.state,
    role: target.persona,
    viewport: opts.viewport,
    device: opts.deviceLabel,
    baselineSha: POST_FIX_483_BASELINE_SHA,
    crawlBaseUrl: CRAWL_BASE_URL,
    timestamp: new Date().toISOString(),
    visualStatus: stillOnLogin ? "BLOCKED" : "OBSERVED",
    functionStatus: evalResult.functionStatus,
    uxStatus: uxFields.uxStatus,
    uxEvidence: uxFields.uxEvidence,
    uxEvidenceSha256,
    uxCriteriaTotal: uxFields.uxCriteriaTotal,
    uxCriteriaEvaluated: uxFields.uxCriteriaEvaluated,
    uxCriteriaPassed: uxFields.uxCriteriaPassed,
    uxCriteriaFailed: uxFields.uxCriteriaFailed,
    uxCriteriaBlocked: uxFields.uxCriteriaBlocked,
    uxFailures: uxFields.uxFailures,
    consoleErrors: [],
    networkErrors: [],
    notes: [
      `Post-fix #483 deploy ${POST_FIX_483_BASELINE_SHA.slice(0, 8)}.`,
      `Fixture ref ${PENDING_APP_FIXTURE_ID}.`,
      sheetNote,
      humanGated ? "S3 HUMAN-GATED — Approve & Activate NOT clicked (production state protection)." : "",
      `Retest: ${JSON.stringify(evalResult.disposition)}`,
    ]
      .filter(Boolean)
      .join(" "),
    evidencePhase: "post-fix-483",
    preFixEvidenceRef: preFixRef,
    postFixDeploySha: POST_FIX_483_BASELINE_SHA,
    credentialPrefix: "TEST_SALES",
    missingSecretNames: [],
    authenticated: !stillOnLogin,
    humanGated,
    retestFailIds: [...PRE_FIX_FAIL_IDS],
    retestDisposition: evalResult.disposition,
  };

  return { row, failures, closedFailIds };
}

export { appendFailureLedger, appendManifestRow, writeTrancheIndex, CRAWL_BASE_URL, ROOT, POST_FIX_483_BASELINE_SHA };
