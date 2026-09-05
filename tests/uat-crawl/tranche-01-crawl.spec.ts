import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import {
  buildUxFields,
  emptyUxEvidence,
  formatUxLedgerRow,
  runPublicSurfaceUxHeuristics,
  screenshotName,
  type UxEvidence,
  type UxFailure,
} from "./ux-helpers";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/tranche-01");
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX.md");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const BASELINE_SHA = "08ccb1cfd4a3624103f0681b5515e26727e77cd2";
const CRAWL_BASE_URL =
  process.env.UAT_CRAWL_BASE_URL ||
  process.env.APP_URL ||
  "https://oasis-baklawa-centra-git-b9f168-oasisbaklawa2006-6222s-projects.vercel.app";

type Target = {
  uatId: string;
  app: string;
  route: string;
  state: string;
  persona: string;
  device: string;
};

const targets: Target[] = JSON.parse(
  readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_TRANCHE_01_TARGETS.json"), "utf8"),
);

function slugRoute(route: string) {
  return route.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-") || "root";
}

type ManifestRow = {
  uatId: string;
  screenshot: string;
  route: string;
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

const manifestRows: ManifestRow[] = [];
const failures: string[] = [];
const uxFailures: string[] = [];

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

async function captureShot(page: import("@playwright/test").Page, filename: string) {
  const screenshotPath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30_000 });
  return `uat-evidence/screenshots/tranche-01/${filename}`;
}

test.describe("Appverse UAT crawl — tranche 01 (UAT-0001..0010) + UX matrix", () => {
  test.beforeAll(() => {
    writeFileSync(MANIFEST_PATH, "");
  });

  for (const target of targets) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }) => {
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
      const routePath = target.route.replace(/\*$/, "catalogue");

      await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(3500);

      const uxEvidence = emptyUxEvidence();
      const shotNames: string[] = [];

      // S0 — settled default page
      const s0File = screenshotName(target.uatId, "central", target.persona, routeSlug, "S0", "default");
      uxEvidence.s0 = await captureShot(page, s0File);
      shotNames.push(s0File);

      const url = page.url();
      const title = await page.title();
      const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);

      let visualStatus: ManifestRow["visualStatus"] = "OBSERVED";
      let functionStatus: ManifestRow["functionStatus"] = "NOT-TESTED";
      let notes = target.route.includes("*") ? "Wildcard route visited as /buyer/catalogue substitute" : "";

      const needsAuth =
        !["/splash", "/login", "/reset-password", "/"].includes(target.route) &&
        !target.route.startsWith("/login");

      const authBlocked =
        needsAuth && (url.includes("/login") || bodyText.toLowerCase().includes("sign in"));

      let uxEvalFailures: UxFailure[] = [];
      let uxEvaluated = 0;
      let uxPassed = 0;
      let uxBlockedCount = 0;

      if (authBlocked) {
        functionStatus = "BLOCKED";
        notes = `${notes} Unauthenticated gate — page content not exercised. CREDENTIAL_REQUIRED for function+UX crawl.`.trim();
        uxBlockedCount = 148;
        failures.push(
          `| FAIL-001-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | desktop | ${target.route} | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | ${s0File} | console:${consoleErrors.length} net:${networkErrors.length} | Open ${routePath} without session | Central | Deploy/Auth | TEST_* or operator credentials |`,
        );
      } else {
        // S1 — try primary nav/menu (login form fields or visible links)
        const menuTrigger = page.locator('nav button, [aria-haspopup="menu"], header button').first();
        if (await menuTrigger.isVisible().catch(() => false)) {
          await menuTrigger.click().catch(() => undefined);
          await page.waitForTimeout(800);
          const s1File = screenshotName(target.uatId, "central", target.persona, routeSlug, "S1", "menu-open");
          uxEvidence.s1 = await captureShot(page, s1File);
          shotNames.push(s1File);
        }

        // S2 — open first dialog/sheet/select if present, else focus primary input
        const dialogTrigger = page
          .locator('button:has-text("Sign"), button[type="submit"], input[type="email"], input[type="password"]')
          .first();
        if (await dialogTrigger.isVisible().catch(() => false)) {
          await dialogTrigger.focus().catch(() => undefined);
          await page.waitForTimeout(400);
          const s2File = screenshotName(target.uatId, "central", target.persona, routeSlug, "S2", "form-focused");
          uxEvidence.s2 = await captureShot(page, s2File);
          shotNames.push(s2File);
        }

        const heuristics = await runPublicSurfaceUxHeuristics(page);
        uxEvalFailures = heuristics.failures;
        uxEvaluated = heuristics.evaluated;
        uxPassed = heuristics.passed;

        for (const f of uxEvalFailures) {
          uxFailures.push(
            formatUxLedgerRow(f, target.uatId, "central", target.persona, "desktop-chrome", target.route, s0File),
          );
        }
      }

      const uxFields = buildUxFields(uxEvidence, uxEvalFailures, {
        blocked: authBlocked,
        evaluated: authBlocked ? 0 : uxEvaluated,
        passed: authBlocked ? 0 : uxPassed,
        failed: uxEvalFailures.length,
        blockedCount: uxBlockedCount,
      });

      if (consoleErrors.length > 0 && visualStatus === "OBSERVED") {
        failures.push(
          `| FAIL-002-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | desktop | ${target.route} | Page load without console errors | Console errors present | P2 | ${s0File} | ${consoleErrors[0]?.slice(0, 120) ?? ""} | Reload ${routePath} | Central | UI/Runtime | — |`,
        );
      }

      manifestRows.push({
        uatId: target.uatId,
        screenshot: uxEvidence.s0!,
        route: target.route,
        role: target.persona,
        viewport: "1440x900",
        device: "desktop-chrome",
        baselineSha: BASELINE_SHA,
        crawlBaseUrl: CRAWL_BASE_URL,
        timestamp: new Date().toISOString(),
        visualStatus,
        functionStatus,
        uxStatus: uxFields.uxStatus,
        uxEvidence: uxFields.uxEvidence,
        uxCriteriaTotal: uxFields.uxCriteriaTotal,
        uxCriteriaEvaluated: uxFields.uxCriteriaEvaluated,
        uxCriteriaPassed: uxFields.uxCriteriaPassed,
        uxCriteriaFailed: uxFields.uxCriteriaFailed,
        uxCriteriaBlocked: uxFields.uxCriteriaBlocked,
        uxFailures: uxFields.uxFailures,
        consoleErrors: consoleErrors.slice(0, 5),
        networkErrors: networkErrors.slice(0, 5),
        notes: `${notes} title="${title}" finalUrl=${url} shots=${shotNames.join(",")}`.trim(),
      });

      appendFileSync(MANIFEST_PATH, `${JSON.stringify(manifestRows[manifestRows.length - 1])}\n`);
      expect(uxEvidence.s0).toBeTruthy();
    });
  }

  test.afterAll(() => {
    const indexLines = [
      "# UAT Visual + UX Crawl Index — Tranche 01",
      "",
      `**Crawl base URL:** ${CRAWL_BASE_URL}`,
      `**Central baseline SHA:** \`${BASELINE_SHA}\``,
      `**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)`,
      `**Captured:** ${new Date().toISOString()}`,
      "",
      "| UAT ID | S0 | Route | Visual | Function | UX | Evaluated | Failures | Notes |",
      "|---|---|---|---|---|---|---:|---:|---|",
      ...manifestRows.map((r) => {
        const s0 = path.basename(r.uxEvidence.s0 ?? r.screenshot);
        return `| ${r.uatId} | [${s0}](../../${r.screenshot}) | ${r.route} | ${r.visualStatus} | ${r.functionStatus} | ${r.uxStatus} | ${r.uxCriteriaEvaluated}/${r.uxCriteriaTotal} | ${r.uxCriteriaFailed} | ${r.notes.slice(0, 60)} |`;
      }),
      "",
      "**UX evidence gaps (tranche 01):** S1–S3 not captured on auth-blocked routes; full 148-criterion evaluation requires role credentials + interactive crawl per [`UAT_UX_FAILURE_MATRIX.md`](./UAT_UX_FAILURE_MATRIX.md).",
      "",
    ];
    writeFileSync(INDEX_PATH, indexLines.join("\n"));

    const preRegistered = [
      "| FAIL-481-001 | UAT-0068† | central | ADMIN_SALES | phone | /admin/clients | Pricing Slab select in review sheet | Dropdown visible above Sheet; slab selectable | Select portal z-50 behind Sheet z-200; options invisible | **P0** | *(physical recording 2026-09-05)* | Issue #481 | Open pending app review sheet on mobile | Central | UI/z-index | Issue **#481** fix merged+deployed |",
      "| FAIL-481-002 | UAT-0068† | central | ADMIN_SALES | phone | /admin/clients | Account Manager select | Managers listed (mixed-case roles) | Role filter lowercase-only excludes production SALES_EXECUTIVE/ADMIN | **P1** | *(physical recording 2026-09-05)* | Issue #481 | Same sheet | Central | RBAC/query | Issue **#481** fix merged+deployed |",
      "| FAIL-UX-481-001 | UAT-0068† | central | ADMIN_SALES | phone | /admin/clients | UX 32/33/36 | Overlay above Sheet | Select clipped behind Sheet | **P0** | physical 2026-09-05 | #481 | Mobile review sheet | Central | UI/UX | #481 |",
      "| FAIL-UX-481-002 | UAT-0068† | central | ADMIN_SALES | phone | /admin/clients | UX 17/36 | Truthful unavailable explanation | Manager list empty (role filter) | **P1** | physical 2026-09-05 | #481 | Same | Central | UI/UX | #481 |",
    ];

    const ledgerHeader = [
      "# UAT Failure Ledger — Tranche 01 bootstrap",
      "",
      "Phase 4 register — **no remediation in this tranche**.",
      "",
      "Functional + UX failures. UX criteria authority: [`UAT_UX_FAILURE_MATRIX.md`](./UAT_UX_FAILURE_MATRIX.md).",
      "",
      "## Functional / access failures",
      "",
      "| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...failures,
      "",
      "## Pre-registered failures (physical evidence, pending re-crawl)",
      "",
      "| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...preRegistered,
      "",
      "† UAT-0068 = census ID for `/admin/clients` default state (see `UAT_ROUTE_CENSUS.json`).",
      "",
    ];

    if (uxFailures.length > 0) {
      ledgerHeader.push(
        "## Automated UX heuristic failures (tranche 01 public surfaces)",
        "",
        "| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
        ...uxFailures,
        "",
      );
    }

    writeFileSync(FAILURE_PATH, ledgerHeader.join("\n"));
  });
});
