/**
 * Authenticated UAT crawl — login via existing TEST_* secrets, S0–S3 evidence
 * in separate auth-rerun folder (preserves pre-auth tranche screenshots).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { login } from "../e2e-helpers";
import {
  appendFailureLedger,
  appendManifestRow,
  BASELINE_SHA,
  CRAWL_BASE_URL,
  isBuyerSheetBlocked,
  ROOT,
  sha256File,
  slugRoute,
  type ManifestRow,
  writeTrancheIndex,
} from "./crawl-engine";
import {
  getCredentials,
  resolveCredentials,
  type CredentialPrefix,
} from "./credential-matrix";
import {
  buildUxFields,
  emptyUxEvidence,
  formatUxLedgerRow,
  runPublicSurfaceUxHeuristics,
  screenshotName,
  type UxFailure,
} from "./ux-helpers";
import type { CrawlTarget } from "./crawl-engine";

export type AuthManifestRow = ManifestRow & {
  evidencePhase: "authenticated";
  preAuthEvidenceRef: string | null;
  credentialPrefix: CredentialPrefix | null;
  missingSecretNames: string[];
  authenticated: boolean;
};

const AUTH_RERUN_IDS: string[] = JSON.parse(
  readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_AUTH_RERUN_TARGETS.json"), "utf8"),
);

export function loadAuthRerunTargets(): CrawlTarget[] {
  const census = JSON.parse(readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8")) as {
    entries: CrawlTarget[];
  };
  const byId = new Map(census.entries.map((e) => [e.uatId, e]));
  return AUTH_RERUN_IDS.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Missing census entry for ${id}`);
    return entry;
  });
}

function preAuthRef(uatId: string): string | null {
  const tranche = Number.parseInt(uatId.replace("UAT-", ""), 10) <= 10 ? "tranche-01" : "tranche-02";
  return `uat-evidence/screenshots/${tranche}/ (pre-auth S0 preserved)`;
}

async function captureAuthShot(
  page: Page,
  screenshotDir: string,
  relPrefix: string,
  filename: string,
) {
  const abs = path.join(screenshotDir, filename);
  await page.screenshot({ path: abs, fullPage: true, timeout: 30_000 });
  return { rel: `${relPrefix}/${filename}`, abs };
}

async function captureInteractionStates(
  page: Page,
  target: CrawlTarget,
  app: string,
  routeSlug: string,
  stateSlug: string,
  screenshotDir: string,
  relPrefix: string,
) {
  const uxEvidence = emptyUxEvidence();
  const uxEvidenceSha256: AuthManifestRow["uxEvidenceSha256"] = {};
  const shotNames: string[] = [];

  const s0Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S0", "auth-settled");
  const s0 = await captureAuthShot(page, screenshotDir, relPrefix, s0Name);
  uxEvidence.s0 = s0.rel;
  uxEvidenceSha256.s0 = sha256File(s0.abs);
  shotNames.push(s0Name);

  const navTrigger = page.locator(
    '[data-sidebar-trigger], nav button, aside button, header button[aria-label*="menu" i], [aria-haspopup="menu"]',
  ).first();
  if (await navTrigger.isVisible().catch(() => false)) {
    await navTrigger.click().catch(() => undefined);
    await page.waitForTimeout(800);
    const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "auth-nav-open");
    const s1 = await captureAuthShot(page, screenshotDir, relPrefix, s1Name);
    uxEvidence.s1 = s1.rel;
    uxEvidenceSha256.s1 = sha256File(s1.abs);
    shotNames.push(s1Name);
  }

  if (target.state === "sheet-review-open") {
    const reviewBtn = page.getByRole("button", { name: /review|pending|approve/i }).first();
    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click().catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    const s2Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S2", "auth-sheet-open");
    const s2 = await captureAuthShot(page, screenshotDir, relPrefix, s2Name);
    uxEvidence.s2 = s2.rel;
    uxEvidenceSha256.s2 = sha256File(s2.abs);
    shotNames.push(s2Name);

    const selectTrigger = page.locator('[role="combobox"], button:has-text("Pricing"), button:has-text("Slab")').first();
    if (await selectTrigger.isVisible().catch(() => false)) {
      await selectTrigger.click().catch(() => undefined);
      await page.waitForTimeout(600);
    }
    const s3Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S3", "auth-overlay-or-blocked");
    const s3 = await captureAuthShot(page, screenshotDir, relPrefix, s3Name);
    uxEvidence.s3 = s3.rel;
    uxEvidenceSha256.s3 = sha256File(s3.abs);
    shotNames.push(s3Name);
  } else {
    const overlayTrigger = page
      .locator('[role="combobox"], button:has-text("Filter"), button:has-text("Search"), input[type="search"]')
      .first();
    if (await overlayTrigger.isVisible().catch(() => false)) {
      if (await overlayTrigger.evaluate((el) => el.tagName === "INPUT").catch(() => false)) {
        await overlayTrigger.focus().catch(() => undefined);
      } else {
        await overlayTrigger.click().catch(() => undefined);
      }
      await page.waitForTimeout(600);
      const s2Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S2", "auth-overlay-open");
      const s2 = await captureAuthShot(page, screenshotDir, relPrefix, s2Name);
      uxEvidence.s2 = s2.rel;
      uxEvidenceSha256.s2 = sha256File(s2.abs);
      shotNames.push(s2Name);
    }

    const s3Name = screenshotName(
      target.uatId,
      app,
      target.persona,
      `${routeSlug}-${stateSlug}`,
      "S3",
      target.classification === "LEGACY_REDIRECT" ? "auth-redirect-settled" : "auth-interaction-result",
    );
    const s3 = await captureAuthShot(page, screenshotDir, relPrefix, s3Name);
    uxEvidence.s3 = s3.rel;
    uxEvidenceSha256.s3 = sha256File(s3.abs);
    shotNames.push(s3Name);
  }

  return { uxEvidence, uxEvidenceSha256, shotNames, s0Name };
}

export async function crawlTargetAuthenticated(
  page: Page,
  target: CrawlTarget,
  opts: { screenshotDir: string; relPrefix: string; viewport: string; deviceLabel: string },
): Promise<{ row: AuthManifestRow; failures: string[]; uxFailures: string[] }> {
  const creds = resolveCredentials(target.persona, target.route);
  const failures: string[] = [];
  const uxFailureRows: string[] = [];
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

  const routeSlug = slugRoute(target.route);
  const stateSlug = target.state.replace(/[^a-zA-Z0-9_-]/g, "-");
  const routePath = target.route.replace(/\*$/, "catalogue");
  const app = target.app === "central" ? "central" : target.app;

  if (!creds.wired || !creds.prefix) {
    const missing = creds.missingSecretNames.join(", ");
    failures.push(
      `| FAIL-AUTH-CRED-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | ${target.device} | ${target.route} | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): ${missing} | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | ${missing} |`,
    );
    const row: AuthManifestRow = {
      uatId: target.uatId,
      tranche: "auth-rerun",
      screenshot: preAuthRef(target.uatId) ?? "",
      screenshotSha256: "",
      route: target.route,
      state: target.state,
      role: target.persona,
      viewport: opts.viewport,
      device: opts.deviceLabel,
      baselineSha: BASELINE_SHA,
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
      notes: `AUTH BLOCKED — missing ${missing}. Pre-auth screenshots preserved in tranche-01/02.`,
      evidencePhase: "authenticated",
      preAuthEvidenceRef: preAuthRef(target.uatId),
      credentialPrefix: creds.prefix,
      missingSecretNames: creds.missingSecretNames,
      authenticated: false,
    };
    return { row, failures, uxFailures: uxFailureRows };
  }

  const { email, password } = getCredentials(creds.prefix);
  let loginError: string | null = null;
  try {
    await login(page, email, password);
  } catch (err) {
    loginError = err instanceof Error ? err.message.slice(0, 300) : String(err);
  }
  await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);

  const url = page.url();
  const title = await page.title();
  const stillOnLogin = Boolean(loginError) || url.includes("/login");

  if (stillOnLogin) {
    failures.push(
      `| FAIL-AUTH-LOGIN-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | ${opts.deviceLabel} | ${target.route} | Login with ${creds.prefix} | Session established | ${loginError ?? "Still on login after credential use"} | P1 | pre-auth preserved | — | Auth rerun | Central | Auth/Network | Verify ${creds.prefix}_* and crawl target URL |`,
    );
  }

  const { uxEvidence, uxEvidenceSha256, shotNames, s0Name } = await captureInteractionStates(
    page,
    target,
    app,
    routeSlug,
    stateSlug,
    opts.screenshotDir,
    opts.relPrefix,
  );

  let functionStatus: AuthManifestRow["functionStatus"] = stillOnLogin ? "BLOCKED" : "OBSERVED";
  let notes = `Authenticated via ${creds.prefix}_* (values not logged).`;
  let uxEvalFailures: UxFailure[] = [];
  let uxEvaluated = 0;
  let uxPassed = 0;
  let uxBlockedCount = 0;

  if (isBuyerSheetBlocked(target) && target.state === "sheet-review-open") {
    functionStatus = "BLOCKED";
    uxBlockedCount = 148;
    notes = `${notes} Buyer sheet UAT-0018/0020 — use post-fix-483-rerun.spec.ts (deploy ace340fe); not auth-rerun.`;
  } else if (!stillOnLogin) {
    const heuristics = await runPublicSurfaceUxHeuristics(page);
    uxEvalFailures = heuristics.failures;
    uxEvaluated = heuristics.evaluated;
    uxPassed = heuristics.passed;
    for (const f of uxEvalFailures) {
      uxFailureRows.push(formatUxLedgerRow(f, target.uatId, app, target.persona, opts.deviceLabel, target.route, s0Name));
    }
  }

  const uxFields = buildUxFields(uxEvidence, uxEvalFailures, {
    blocked: stillOnLogin || (isBuyerSheetBlocked(target) && target.state === "sheet-review-open"),
    evaluated: uxEvaluated,
    passed: uxPassed,
    failed: uxEvalFailures.length,
    blockedCount: uxBlockedCount,
  });

  const row: AuthManifestRow = {
    uatId: target.uatId,
    tranche: "auth-rerun",
    screenshot: uxEvidence.s0!,
    screenshotSha256: uxEvidenceSha256.s0!,
    route: target.route,
    state: target.state,
    role: target.persona,
    viewport: opts.viewport,
    device: opts.deviceLabel,
    baselineSha: BASELINE_SHA,
    crawlBaseUrl: CRAWL_BASE_URL,
    timestamp: new Date().toISOString(),
    visualStatus: stillOnLogin ? "BLOCKED" : "OBSERVED",
    functionStatus,
    uxStatus: uxFields.uxStatus,
    uxEvidence: uxFields.uxEvidence,
    uxEvidenceSha256,
    uxCriteriaTotal: uxFields.uxCriteriaTotal,
    uxCriteriaEvaluated: uxFields.uxCriteriaEvaluated,
    uxCriteriaPassed: uxFields.uxCriteriaPassed,
    uxCriteriaFailed: uxFields.uxCriteriaFailed,
    uxCriteriaBlocked: uxFields.uxCriteriaBlocked,
    uxFailures: uxFields.uxFailures,
    consoleErrors: consoleErrors.slice(0, 5),
    networkErrors: networkErrors.slice(0, 5),
    notes: `${notes} title="${title}" finalUrl=${url} shots=${shotNames.join(",")}`.trim(),
    evidencePhase: "authenticated",
    preAuthEvidenceRef: preAuthRef(target.uatId),
    credentialPrefix: creds.prefix,
    missingSecretNames: [],
    authenticated: !stillOnLogin,
  };

  return { row, failures, uxFailures: uxFailureRows };
}
