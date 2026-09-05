import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";

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

function sha256File(_path: string): string {
  return "pending-local-hash";
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
  consoleErrors: string[];
  networkErrors: string[];
  notes: string;
};

const manifestRows: ManifestRow[] = [];
const failures: string[] = [];

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

test.describe("Appverse UAT crawl — tranche 01 (UAT-0001..0010)", () => {
  test.beforeAll(() => {
    writeFileSync(MANIFEST_PATH, "");
  });

  for (const target of targets) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }, testInfo) => {
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

      const routePath = target.route.replace(/\*$/, "catalogue");
      await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(3500);

      const filename = `${target.uatId}_central_${target.persona.toLowerCase()}_${slugRoute(target.route)}_${target.state}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30_000 });

      const url = page.url();
      const title = await page.title();
      const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);

      let visualStatus: ManifestRow["visualStatus"] = "OBSERVED";
      let functionStatus: ManifestRow["functionStatus"] = "NOT-TESTED";
      let notes = target.route.includes("*") ? "Wildcard route visited as /buyer/catalogue substitute" : "";

      const needsAuth =
        !["/splash", "/login", "/reset-password", "/"].includes(target.route) &&
        !target.route.startsWith("/login");

      if (needsAuth && (url.includes("/login") || bodyText.toLowerCase().includes("sign in"))) {
        visualStatus = "OBSERVED";
        functionStatus = "BLOCKED";
        notes = `${notes} Unauthenticated gate — page content not exercised. CREDENTIAL_REQUIRED for function crawl.`.trim();
        failures.push(
          `| FAIL-001-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | desktop | ${target.route} | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | ${filename} | console:${consoleErrors.length} net:${networkErrors.length} | Open ${routePath} without session | Central | Deploy/Auth | TEST_* or operator credentials |`,
        );
      }

      if (consoleErrors.length > 0 && visualStatus === "OBSERVED") {
        failures.push(
          `| FAIL-002-${target.uatId.slice(-4)} | ${target.uatId} | central | ${target.persona} | desktop | ${target.route} | Page load without console errors | Console errors present | P2 | ${filename} | ${consoleErrors[0]?.slice(0, 120) ?? ""} | Reload ${routePath} | Central | UI/Runtime | — |`,
        );
      }

      manifestRows.push({
        uatId: target.uatId,
        screenshot: `uat-evidence/screenshots/tranche-01/${filename}`,
        route: target.route,
        role: target.persona,
        viewport: "1440x900",
        device: "desktop-chrome",
        baselineSha: BASELINE_SHA,
        crawlBaseUrl: CRAWL_BASE_URL,
        timestamp: new Date().toISOString(),
        visualStatus,
        functionStatus,
        consoleErrors: consoleErrors.slice(0, 5),
        networkErrors: networkErrors.slice(0, 5),
        notes: `${notes} title="${title}" finalUrl=${url}`.trim(),
      });

      appendFileSync(MANIFEST_PATH, `${JSON.stringify(manifestRows[manifestRows.length - 1])}\n`);
      expect(screenshotPath).toBeTruthy();
    });
  }

  test.afterAll(() => {
    const indexLines = [
      "# UAT Visual Crawl Index — Tranche 01",
      "",
      `**Crawl base URL:** ${CRAWL_BASE_URL}`,
      `**Central baseline SHA:** \`${BASELINE_SHA}\``,
      `**Captured:** ${new Date().toISOString()}`,
      "",
      "| UAT ID | Screenshot | Route | Visual | Function | Notes |",
      "|---|---|---|---|---|---|",
      ...manifestRows.map(
        (r) =>
          `| ${r.uatId} | [${path.basename(r.screenshot)}](../../${r.screenshot}) | ${r.route} | ${r.visualStatus} | ${r.functionStatus} | ${r.notes.slice(0, 80)} |`,
      ),
      "",
    ];
    writeFileSync(INDEX_PATH, indexLines.join("\n"));

    const ledgerHeader = [
      "# UAT Failure Ledger — Tranche 01 bootstrap",
      "",
      "Phase 4 register — **no remediation in this tranche**.",
      "",
      "| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...failures,
      "",
    ].join("\n");
    writeFileSync(FAILURE_PATH, ledgerHeader);
  });
});
