/**
 * Authenticated UAT crawl — login via existing TEST_* secrets, S0–S3 evidence
 * in separate auth-rerun folder (preserves pre-auth tranche screenshots).
 */
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { login } from "../e2e-helpers";
import {
  appendFailureLedger,
  appendManifestRow,
  BASELINE_SHA,
  CURRENT_MAIN_SHA,
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

/** Eight authenticated surfaces where prior S2 fallbacks did not match full-bleed / TV / war-room DOM. */
export const S2_GAP_TARGET_IDS = [
  "UAT-0002",
  "UAT-0037",
  "UAT-0038",
  "UAT-0052",
  "UAT-0053",
  "UAT-0061",
  "UAT-0080",
  "UAT-0094",
] as const;

const FULL_BLEED_ROUTES = new Set([
  "/operations-controller",
  "/admin/operator-inbox",
  "/admin/whatsapp",
  "/admin/central-pool",
  "/admin/cmd-war-room",
  "/admin/assembly-tv",
  "/admin/execution/production",
  "/admin/dispatch-mgmt",
]);

export function loadAuthRerunTargets(): CrawlTarget[] {
  return loadTargetsByIds(AUTH_RERUN_IDS);
}

export function loadTargetsByIds(ids: readonly string[]): CrawlTarget[] {
  const census = JSON.parse(readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8")) as {
    entries: CrawlTarget[];
  };
  const byId = new Map(census.entries.map((e) => [e.uatId, e]));
  return ids.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Missing census entry for ${id}`);
    return entry;
  });
}

export function loadS2GapTargets(): CrawlTarget[] {
  return loadTargetsByIds(S2_GAP_TARGET_IDS);
}

const APP_DEPLOY_SECRET: Record<string, string> = {
  "ai-studio": "TEST_AI_STUDIO_PREVIEW_URL",
  trace: "TEST_TRACE_PREVIEW_URL",
};

function resolveDeploySecret(app: string): string {
  return APP_DEPLOY_SECRET[app] ?? `TEST_${app.replace(/-/g, "_").toUpperCase()}_PREVIEW_URL`;
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
  mkdirSync(screenshotDir, { recursive: true });
  const abs = path.join(screenshotDir, filename);
  await page.screenshot({ path: abs, fullPage: true, timeout: 30_000 });
  return { rel: `${relPrefix}/${filename}`, abs };
}

async function prepareInteractiveState(page: Page, target: CrawlTarget) {
  if (target.state === "filter-empty") {
    const orderInput = page.locator("#dispatch-order-id, input[id*='order' i]").first();
    if (await orderInput.isVisible().catch(() => false)) {
      await orderInput.focus().catch(() => undefined);
      await page.waitForTimeout(400);
      return;
    }
    const consignmentSelect = page.locator("#dispatch-working-consignment, [role='combobox']").first();
    if (await consignmentSelect.isVisible().catch(() => false)) {
      await consignmentSelect.click().catch(() => undefined);
      await page.waitForTimeout(600);
    }
  }
}

async function tryCaptureAuthS1Fallback(
  page: Page,
  target: CrawlTarget,
  app: string,
  routeSlug: string,
  stateSlug: string,
  screenshotDir: string,
  relPrefix: string,
) {
  const phhTab = page.locator('button:has-text("Execute"), button:has-text("Quick Log"), button:has-text("Day End")').first();
  const inboxSearch = page.locator('input[placeholder*="Search" i], input[placeholder*="search" i]').first();
  const topNavBtn = page.locator("header button:visible, nav button:visible").first();
  const tvColumn = page.locator("div.rounded-xl, div.rounded-t-xl").first();
  const dispatchInput = page.locator("#dispatch-order-id, #dispatch-working-consignment").first();
  const candidates: Array<{ label: string; locator: ReturnType<Page["locator"]> }> = [
    { label: "auth-phh-tab-hover", locator: phhTab },
    { label: "auth-inbox-search-hover", locator: inboxSearch },
    { label: "auth-topnav-hover", locator: topNavBtn },
    { label: "auth-tv-column-hover", locator: tvColumn },
    { label: "auth-dispatch-control-hover", locator: dispatchInput },
  ];
  for (const { label, locator } of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.scrollIntoViewIfNeeded().catch(() => undefined);
      if (label.includes("search") || label.includes("dispatch-control")) {
        await locator.focus().catch(() => undefined);
      } else {
        await locator.hover().catch(() => undefined);
      }
      await page.waitForTimeout(400);
      const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", label);
      const s1 = await captureAuthShot(page, screenshotDir, relPrefix, s1Name);
      return { rel: s1.rel, sha: sha256File(s1.abs), name: s1Name };
    }
  }
  return null;
}

async function tryCaptureAuthS2(
  page: Page,
  target: CrawlTarget,
  app: string,
  routeSlug: string,
  stateSlug: string,
  screenshotDir: string,
  relPrefix: string,
) {
  const strategies: Array<{ label: string; locator: ReturnType<Page["locator"]>; act: "click" | "focus" | "hover" | "scroll" }> = [
    {
      label: "auth-overlay-open",
      locator: page.locator('[role="combobox"], button:has-text("Filter"), button:has-text("Search"), input[type="search"]').first(),
      act: "click",
    },
    {
      label: "auth-phh-tab-open",
      locator: page.locator('button:has-text("Execute"), button:has-text("Quick Log"), button:has-text("Day End")').first(),
      act: "click",
    },
    {
      label: "auth-tab-open",
      locator: page.locator('[role="tablist"] [role="tab"]:not([data-state="active"])').first(),
      act: "click",
    },
    {
      label: "auth-toggle-open",
      locator: page.locator('[role="group"] button[data-state="off"], [data-state="off"][role="radio"]').first(),
      act: "click",
    },
    {
      label: "auth-inbox-filter-focus",
      locator: page.locator('input[placeholder*="Search" i], input[placeholder*="filter" i], input[type="search"]').first(),
      act: "focus",
    },
    {
      label: "auth-dispatch-order-focus",
      locator: page.locator("#dispatch-order-id, #dispatch-working-consignment, #dispatch-dispatch-mode").first(),
      act: "focus",
    },
    {
      label: "auth-select-open",
      locator: page.locator("select, [role='combobox']").first(),
      act: "click",
    },
    {
      label: "auth-row-hover",
      locator: page.locator("table tbody tr, [role='rowgroup'] [role='row'], div.rounded-xl.border").first(),
      act: "hover",
    },
    {
      label: "auth-main-button-focus",
      locator: page.locator('main button:visible, main [role="button"]:visible').first(),
      act: "focus",
    },
    {
      label: "auth-page-button-focus",
      locator: page.locator('button:visible:not([disabled])').first(),
      act: "focus",
    },
    {
      label: "auth-card-hover",
      locator: page.locator('main [class*="card"]:visible, main article:visible, div.rounded-xl.p-3').first(),
      act: "hover",
    },
    {
      label: "auth-link-hover",
      locator: page.locator("a[href]:visible").first(),
      act: "hover",
    },
    {
      label: "auth-content-scroll",
      locator: page.locator("body"),
      act: "scroll",
    },
  ];

  for (const strategy of strategies) {
    if (!(await strategy.locator.isVisible().catch(() => false))) continue;
    await strategy.locator.scrollIntoViewIfNeeded().catch(() => undefined);
    if (strategy.act === "click") {
      const isInput = await strategy.locator.evaluate((el) => el.tagName === "INPUT").catch(() => false);
      if (isInput) await strategy.locator.focus().catch(() => undefined);
      else await strategy.locator.click().catch(() => undefined);
    } else if (strategy.act === "focus") {
      await strategy.locator.focus().catch(() => undefined);
    } else if (strategy.act === "hover") {
      await strategy.locator.hover().catch(() => undefined);
    } else {
      await page.evaluate(() => window.scrollBy(0, 400));
    }
    await page.waitForTimeout(600);
    const s2Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S2", strategy.label);
    const s2 = await captureAuthShot(page, screenshotDir, relPrefix, s2Name);
    return { rel: s2.rel, sha: sha256File(s2.abs), name: s2Name };
  }
  return null;
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
    '[data-sidebar="trigger"], [data-sidebar-trigger], button:has-text("Toggle Sidebar"), nav button, aside button, header button[aria-label*="menu" i], [aria-haspopup="menu"]',
  ).first();
  if (await navTrigger.isVisible().catch(() => false)) {
    await navTrigger.click().catch(() => undefined);
    await page.waitForTimeout(800);
    const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "auth-nav-open");
    const s1 = await captureAuthShot(page, screenshotDir, relPrefix, s1Name);
    uxEvidence.s1 = s1.rel;
    uxEvidenceSha256.s1 = sha256File(s1.abs);
    shotNames.push(s1Name);
  } else {
    const mobileNav = page.locator('button[aria-label="Open navigation"]');
    if (await mobileNav.isVisible().catch(() => false)) {
      await mobileNav.click().catch(() => undefined);
      await page.waitForTimeout(800);
      const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "auth-mobile-nav-open");
      const s1 = await captureAuthShot(page, screenshotDir, relPrefix, s1Name);
      uxEvidence.s1 = s1.rel;
      uxEvidenceSha256.s1 = sha256File(s1.abs);
      shotNames.push(s1Name);
    } else {
      const sidebarHover = page.locator('aside nav a, aside a[href^="/"]').first();
      if (await sidebarHover.isVisible().catch(() => false)) {
        await sidebarHover.hover().catch(() => undefined);
        await page.waitForTimeout(400);
        const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "auth-sidebar-hover");
        const s1 = await captureAuthShot(page, screenshotDir, relPrefix, s1Name);
        uxEvidence.s1 = s1.rel;
        uxEvidenceSha256.s1 = sha256File(s1.abs);
        shotNames.push(s1Name);
      } else {
        const mainNavHover = page
          .locator('[role="tablist"] [role="tab"], nav[aria-label] a, header nav a, main nav a')
          .first();
        const mainInteractive = page
          .locator('main button:visible, main [role="button"]:visible, main a[href]:visible')
          .first();
        const s1Target = (await mainNavHover.isVisible().catch(() => false)) ? mainNavHover : mainInteractive;
        if (await s1Target.isVisible().catch(() => false)) {
          await s1Target.hover().catch(() => undefined);
          await page.waitForTimeout(400);
          const s1Label = (await mainNavHover.isVisible().catch(() => false))
            ? "auth-main-nav-hover"
            : "auth-main-interactive-hover";
          const s1Name = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", s1Label);
          const s1 = await captureAuthShot(page, screenshotDir, relPrefix, s1Name);
          uxEvidence.s1 = s1.rel;
          uxEvidenceSha256.s1 = sha256File(s1.abs);
          shotNames.push(s1Name);
        } else {
          const s1Fallback = await tryCaptureAuthS1Fallback(page, target, app, routeSlug, stateSlug, screenshotDir, relPrefix);
          if (s1Fallback) {
            uxEvidence.s1 = s1Fallback.rel;
            uxEvidenceSha256.s1 = s1Fallback.sha;
            shotNames.push(s1Fallback.name);
          }
        }
      }
    }
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
    await prepareInteractiveState(page, target);
    const s2Capture = await tryCaptureAuthS2(page, target, app, routeSlug, stateSlug, screenshotDir, relPrefix);
    if (s2Capture) {
      uxEvidence.s2 = s2Capture.rel;
      uxEvidenceSha256.s2 = s2Capture.sha;
      shotNames.push(s2Capture.name);
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
  opts: {
    screenshotDir: string;
    relPrefix: string;
    viewport: string;
    deviceLabel: string;
    trancheLabel?: string;
  },
): Promise<{ row: AuthManifestRow; failures: string[]; uxFailures: string[] }> {
  const trancheLabel = opts.trancheLabel ?? process.env.UAT_TRANCHE_LABEL ?? "auth-rerun";
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

  if (target.app !== "central" && target.app !== "buyer-mobile") {
    const deploySecret = resolveDeploySecret(target.app);
    failures.push(
      `| FAIL-AUTH-DEPLOY-${target.uatId.slice(-4)} | ${target.uatId} | ${target.app} | ${target.persona} | ${opts.deviceLabel} | ${target.route} | Authenticated crawl on ${target.app} deploy | Role surface on correct preview host | BLOCKED — missing ${deploySecret} (Central TEST_PREVIEW_URL is not valid for ${target.app}) | P1 | — | — | ${trancheLabel} | ${target.repo} | Deploy | ${deploySecret} |`,
    );
    const row: AuthManifestRow = {
      uatId: target.uatId,
      tranche: trancheLabel,
      screenshot: "",
      screenshotSha256: "",
      route: target.route,
      state: target.state,
      role: target.persona,
      viewport: opts.viewport,
      device: opts.deviceLabel,
      baselineSha: CURRENT_MAIN_SHA,
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
      notes: `DEPLOY BLOCKED — ${target.app} requires ${deploySecret}; not runnable on Central preview URL.`,
      evidencePhase: "authenticated",
      preAuthEvidenceRef: null,
      credentialPrefix: creds.prefix,
      missingSecretNames: [deploySecret],
      authenticated: false,
    };
    return { row, failures, uxFailures: uxFailureRows };
  }

  if (!creds.wired || !creds.prefix) {
    const missing = creds.missingSecretNames.join(", ");
    failures.push(
      `| FAIL-AUTH-CRED-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | ${target.device} | ${target.route} | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): ${missing} | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | ${missing} |`,
    );
    const row: AuthManifestRow = {
      uatId: target.uatId,
      tranche: trancheLabel,
      screenshot: preAuthRef(target.uatId) ?? "",
      screenshotSha256: "",
      route: target.route,
      state: target.state,
      role: target.persona,
      viewport: opts.viewport,
      device: opts.deviceLabel,
      baselineSha: CURRENT_MAIN_SHA,
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
  if (target.classification === "LEGACY_REDIRECT") {
    await page.waitForTimeout(2500);
  }
  const settleMs = FULL_BLEED_ROUTES.has(target.route) || target.device === "tv" ? 5500 : 3500;
  await page.waitForTimeout(settleMs);

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
    tranche: trancheLabel,
    screenshot: uxEvidence.s0!,
    screenshotSha256: uxEvidenceSha256.s0!,
    route: target.route,
    state: target.state,
    role: target.persona,
    viewport: opts.viewport,
    device: opts.deviceLabel,
    baselineSha: CURRENT_MAIN_SHA,
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
