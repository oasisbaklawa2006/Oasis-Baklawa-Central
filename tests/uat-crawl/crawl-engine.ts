/**
 * Shared Appverse UAT crawl engine — read-only evidence collection.
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import {
  buildUxFields,
  emptyUxEvidence,
  formatUxLedgerRow,
  runPublicSurfaceUxHeuristics,
  screenshotName,
  type UxEvidence,
  type UxFailure,
} from "./ux-helpers";

export const ROOT = path.resolve(import.meta.dirname, "../..");
/** Pre-UAT programme baseline (tranche-01 pre-auth). Preserved — not reused as current deploy evidence. */
export const BASELINE_SHA = "08ccb1cfd4a3624103f0681b5515e26727e77cd2";
/** Current Central main after #497 merge (FAIL-493-001 repair) — governed current-main deploy target. */
export const CURRENT_MAIN_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
/** Prior main hold (#491) — preserved for historical ace340fe continuation evidence only. */
export const PRIOR_MAIN_HOLD_SHA = "64a107dfc167be76673a3d18f177a72472dcb241";
/** Historical #483 merge SHA — pre-fix/post-fix tranche-02 reference only; not current deploy evidence. */
export const LEGACY_483_DEPLOY_SHA = "ace340fe1d122a4cce5d7bb61cd237ed7ba1c894";
/** Post-fix buyer sheet re-test binds to current main (#483+#490 lineage). */
export const POST_FIX_483_BASELINE_SHA = CURRENT_MAIN_SHA;
export const CRAWL_BASE_URL =
  process.env.UAT_CRAWL_BASE_URL ||
  process.env.TEST_PREVIEW_URL ||
  process.env.APP_URL ||
  "https://oasis-baklawa-centra-git-b9f168-oasisbaklawa2006-6222s-projects.vercel.app";

export type CrawlTarget = {
  uatId: string;
  app: string;
  route: string;
  state: string;
  classification?: string;
  persona: string;
  device: string;
  notes?: string;
};

export type ManifestRow = {
  uatId: string;
  tranche: string;
  screenshot: string;
  screenshotSha256: string;
  route: string;
  state: string;
  role: string;
  viewport: string;
  device: string;
  baselineSha: string;
  crawlBaseUrl: string;
  timestamp: string;
  visualStatus: "OBSERVED" | "FAIL" | "BLOCKED" | "NOT-TESTED";
  functionStatus: "NOT-TESTED" | "BLOCKED" | "OBSERVED" | "FAIL";
  uxStatus: "NOT-TESTED" | "PARTIAL" | "PASS" | "FAIL" | "BLOCKED";
  uxEvidence: UxEvidence;
  uxEvidenceSha256: Partial<Record<keyof UxEvidence, string>>;
  uxCriteriaTotal: number;
  uxCriteriaEvaluated: number;
  uxCriteriaPassed: number;
  uxCriteriaFailed: number;
  uxCriteriaBlocked: number;
  uxFailures: UxFailure[];
  consoleErrors: string[];
  networkErrors: string[];
  notes: string;
};

export type CrawlResult = {
  row: ManifestRow;
  failures: string[];
  uxFailures: string[];
};

export function slugRoute(route: string) {
  return route.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-") || "root";
}

export function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

const PUBLIC_ROUTES = new Set(["/splash", "/login", "/reset-password", "/"]);

const BUYER_SHEET_PRE_FIX_BLOCKED = new Set(["UAT-0018", "UAT-0020"]);

/** Pre-auth / generic crawls block buyer sheet IDs until post-fix-483 evidence exists. */
export function isBuyerSheetBlocked(target: CrawlTarget): boolean {
  return BUYER_SHEET_PRE_FIX_BLOCKED.has(target.uatId);
}

export function loadTargetsFromCensus(startId: string, endId: string): CrawlTarget[] {
  const census = JSON.parse(readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8")) as {
    entries: CrawlTarget[];
  };
  const start = Number.parseInt(startId.replace("UAT-", ""), 10);
  const end = Number.parseInt(endId.replace("UAT-", ""), 10);
  return census.entries.filter((e) => {
    const n = Number.parseInt(e.uatId.replace("UAT-", ""), 10);
    return n >= start && n <= end;
  });
}

async function captureShot(page: Page, screenshotDir: string, relPrefix: string, filename: string) {
  mkdirSync(screenshotDir, { recursive: true });
  const abs = path.join(screenshotDir, filename);
  await page.screenshot({ path: abs, fullPage: true, timeout: 30_000 });
  return `${relPrefix}/${filename}`;
}

export async function crawlTarget(
  page: Page,
  target: CrawlTarget,
  opts: { tranche: string; screenshotDir: string; relPrefix: string; viewport: string; deviceLabel: string },
): Promise<CrawlResult> {
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

  await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);

  const uxEvidence = emptyUxEvidence();
  const uxEvidenceSha256: Partial<Record<keyof UxEvidence, string>> = {};
  const shotNames: string[] = [];
  const failures: string[] = [];
  const uxFailureRows: string[] = [];

  const s0File = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S0", "default");
  uxEvidence.s0 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s0File);
  uxEvidenceSha256.s0 = sha256File(path.join(opts.screenshotDir, s0File));
  shotNames.push(s0File);

  const url = page.url();
  const title = await page.title();
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);

  const visualStatus: ManifestRow["visualStatus"] = "OBSERVED";
  let functionStatus: ManifestRow["functionStatus"] = "NOT-TESTED";
  let notes = target.notes ?? "";
  if (target.route.includes("*")) notes = `${notes} Wildcard route visited as /buyer/catalogue substitute`.trim();
  if (target.classification === "LEGACY_REDIRECT") {
    notes = `${notes} Legacy redirect — finalUrl captured for function crawl`.trim();
  }

  const needsAuth = !PUBLIC_ROUTES.has(target.route) && !target.route.startsWith("/login");
  const authBlocked = needsAuth && (url.includes("/login") || bodyText.toLowerCase().includes("sign in"));
  const buyerSheetBlocked = isBuyerSheetBlocked(target);

  let uxEvalFailures: UxFailure[] = [];
  let uxEvaluated = 0;
  let uxPassed = 0;
  let uxBlockedCount = 0;

  if (buyerSheetBlocked && target.state === "sheet-review-open") {
    functionStatus = "BLOCKED";
    uxBlockedCount = 148;
    notes = `${notes} Buyer approval sheet-review BLOCKED — P0 #483 not deployed; preserve pre-fix FAIL-481-* / FAIL-UX-481-* evidence; re-test SAME UAT/FAIL IDs post-deploy with ADMIN_SALES credentials + pending app fixture dc370b46`.trim();
    failures.push(
      `| FAIL-BLOCK-483-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | ${target.device} | ${target.route} [${target.state}] | Buyer approval sheet UX (#483) | Sheet open with visible Select overlays | BLOCKED pending #483 deploy + credentials + fixture | **P0** | ${s0File} | pre-fix evidence preserved | Do not re-test until #483 lands | Central | UI/UX | Issue **#483** deploy |`,
    );
  } else if (authBlocked) {
    functionStatus = "BLOCKED";
    notes = `${notes} Unauthenticated gate — CREDENTIAL_REQUIRED for function+UX crawl`.trim();
    uxBlockedCount = 148;
    failures.push(
      `| FAIL-001-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | ${opts.deviceLabel} | ${target.route} | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | ${s0File} | console:${consoleErrors.length} net:${networkErrors.length} | Open ${routePath} without session | Central | Deploy/Auth | TEST_* or operator credentials |`,
    );
  } else {
    const menuTrigger = page.locator('nav button, [aria-haspopup="menu"], header button').first();
    if (await menuTrigger.isVisible().catch(() => false)) {
      await menuTrigger.click().catch(() => undefined);
      await page.waitForTimeout(800);
      const s1File = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "menu-open");
      uxEvidence.s1 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s1File);
      uxEvidenceSha256.s1 = sha256File(path.join(opts.screenshotDir, s1File));
      shotNames.push(s1File);
    } else {
      const linkHover = page
        .locator('a[href*="reset"], a[href*="password"], a[href*="login"], main a[href]:visible')
        .first();
      if (await linkHover.isVisible().catch(() => false)) {
        await linkHover.hover().catch(() => undefined);
        await page.waitForTimeout(400);
        const s1File = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S1", "link-hover");
        uxEvidence.s1 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s1File);
        uxEvidenceSha256.s1 = sha256File(path.join(opts.screenshotDir, s1File));
        shotNames.push(s1File);
      }
    }

    const dialogTrigger = page
      .locator(
        'input[type="email"], input[name="email"], input[autocomplete="email"], input[type="password"], button:has-text("Sign"), button[type="submit"]',
      )
      .first();
    if (await dialogTrigger.isVisible().catch(() => false)) {
      await dialogTrigger.focus().catch(() => undefined);
      await page.waitForTimeout(400);
      const s2File = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S2", "form-focused");
      uxEvidence.s2 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s2File);
      uxEvidenceSha256.s2 = sha256File(path.join(opts.screenshotDir, s2File));
      shotNames.push(s2File);
    }

    if (target.classification === "LEGACY_REDIRECT") {
      const s3File = screenshotName(target.uatId, app, target.persona, `${routeSlug}-${stateSlug}`, "S3", "redirect-settled");
      uxEvidence.s3 = await captureShot(page, opts.screenshotDir, opts.relPrefix, s3File);
      uxEvidenceSha256.s3 = sha256File(path.join(opts.screenshotDir, s3File));
      shotNames.push(s3File);
    }

    const heuristics = await runPublicSurfaceUxHeuristics(page);
    uxEvalFailures = heuristics.failures;
    uxEvaluated = heuristics.evaluated;
    uxPassed = heuristics.passed;

    for (const f of uxEvalFailures) {
      uxFailureRows.push(
        formatUxLedgerRow(f, target.uatId, app, target.persona, opts.deviceLabel, target.route, s0File),
      );
    }
  }

  const uxFields = buildUxFields(uxEvidence, uxEvalFailures, {
    blocked: authBlocked || (buyerSheetBlocked && target.state === "sheet-review-open"),
    evaluated: uxBlockedCount > 0 ? 0 : uxEvaluated,
    passed: uxBlockedCount > 0 ? 0 : uxPassed,
    failed: uxEvalFailures.length,
    blockedCount: uxBlockedCount,
  });

  if (consoleErrors.length > 0) {
    failures.push(
      `| FAIL-002-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | ${opts.deviceLabel} | ${target.route} | Page load without console errors | Console errors present | P2 | ${s0File} | ${consoleErrors[0]?.slice(0, 120) ?? ""} | Reload ${routePath} | Central | UI/Runtime | — |`,
    );
  }

  const row: ManifestRow = {
    uatId: target.uatId,
    tranche: opts.tranche,
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
    visualStatus,
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
  };

  return { row, failures, uxFailures: uxFailureRows };
}

export function appendManifestRow(manifestPath: string, row: ManifestRow) {
  appendFileSync(manifestPath, `${JSON.stringify(row)}\n`);
}

/** Replace rows by uatId — append-only merge for targeted re-crawl tranches. */
export function mergeAuthManifestRows(manifestPath: string, updatedRows: ManifestRow[]) {
  const existing = readFileSync(manifestPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ManifestRow);
  const updates = new Map(updatedRows.map((row) => [row.uatId, row]));
  const merged = existing.map((row) => updates.get(row.uatId) ?? row);
  for (const row of updatedRows) {
    if (!existing.some((existingRow) => existingRow.uatId === row.uatId)) {
      merged.push(row);
    }
  }
  writeFileSync(manifestPath, `${merged.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

export function writeTrancheIndex(
  indexPath: string,
  tranche: string,
  uatRange: string,
  rows: ManifestRow[],
  extraNotes: string[] = [],
) {
  const lines = [
    `# UAT Visual + UX Crawl Index — ${tranche}`,
    "",
    `**UAT range:** ${uatRange}`,
    `**Crawl base URL:** ${CRAWL_BASE_URL}`,
    `**Central baseline SHA:** \`${BASELINE_SHA}\``,
    `**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)`,
    `**Captured:** ${new Date().toISOString()}`,
    "",
    "| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |",
    "|---|---|---|---|---|---|---|---:|---:|---|",
    ...rows.map((r) => {
      const s0 = path.basename(r.uxEvidence.s0 ?? r.screenshot);
      return `| ${r.uatId} | [${s0}](../../${r.screenshot}) | ${r.route} | ${r.state} | ${r.visualStatus} | ${r.functionStatus} | ${r.uxStatus} | ${r.uxCriteriaEvaluated}/${r.uxCriteriaTotal} | ${r.uxCriteriaFailed} | ${r.notes.slice(0, 55)} |`;
    }),
    "",
    ...extraNotes,
    "",
  ];
  writeFileSync(indexPath, lines.join("\n"));
}

export function appendFailureLedger(
  ledgerPath: string,
  tranche: string,
  functionalFailures: string[],
  uxFailures: string[],
) {
  const existing = readFileSync(ledgerPath, "utf8");
  const section = [
    "",
    `---`,
    "",
    `## ${tranche} crawl failures (${new Date().toISOString().slice(0, 10)})`,
    "",
  ];

  if (functionalFailures.length > 0) {
    section.push(
      "### Functional / access / blocked",
      "",
      "| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...functionalFailures,
      "",
    );
  }

  if (uxFailures.length > 0) {
    section.push(
      "### Automated UX heuristic failures",
      "",
      "| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...uxFailures,
      "",
    );
  }

  writeFileSync(ledgerPath, existing + section.join("\n"));
}
