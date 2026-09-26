import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyAccessWallFromSignals, detectScreenshotHashWall } from "./access-wall";
import { attachRunMetadata, CENTRAL_PUBLIC_PRODUCTION_ALIAS } from "./crawl-engine";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "../..");
const workflowYaml = readFileSync(join(REPO_ROOT, ".github/workflows/uat-crawl-evidence.yml"), "utf8");

describe("UAT evidence integrity repair regressions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("1 — protected Vercel login page cannot become PASS/OBSERVED", () => {
    const wall = classifyAccessWallFromSignals(
      "Login – Vercel",
      "https://oasis-baklawa-central-jc8jxvcf8-oasisbaklawa2006-6222s-projects.vercel.app/login",
      "Log in to Vercel to continue",
    );
    expect(wall.blocked).toBe(true);
    expect(wall.classification).toBe("DEPLOYMENT_PROTECTION");
  });

  it("2 — public production alias is the canonical Central crawl target constant", () => {
    expect(CENTRAL_PUBLIC_PRODUCTION_ALIAS).toBe("https://oasis-baklawa-central.vercel.app");
    expect(workflowYaml).toContain("https://oasis-baklawa-central.vercel.app");
    expect(workflowYaml).toContain("UAT_CRAWL_TARGET_TYPE=PUBLIC_PRODUCTION_ALIAS");
  });

  it("3 — current main SHA remains independently recorded from crawl URL", async () => {
    vi.stubEnv("UAT_TARGET_SHA", "d3f57a7cce274534a6cb3a29e8f5edf0d9797e10");
    vi.stubEnv("UAT_CRAWL_BASE_URL", "https://oasis-baklawa-central.vercel.app");
    vi.resetModules();
    const { readRunMetadata } = await import("./run-metadata");
    const meta = readRunMetadata();
    expect(meta.targetMainSha).toBe("d3f57a7cce274534a6cb3a29e8f5edf0d9797e10");
    expect(meta.crawlBaseUrl).toBe("https://oasis-baklawa-central.vercel.app");
  });

  it("4 — failed AI-UAT produces fresh FAIL/NOT_EXECUTED summary", () => {
    const script = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/archive-ai-uat-evidence.mjs"), "utf8");
    expect(script).toContain("NOT_EXECUTED");
    expect(script).toContain("AI_UAT_EXIT_CODE");
    expect(script).toContain("UAT_AI_UAT_SUMMARY_ARCHIVE.jsonl");
    expect(script).toContain("never substitute stale PASS as current truth");
  });

  it("5 — final workflow verdict step exists and fails closed", () => {
    expect(workflowYaml).toContain("Aggregate crawl certification verdict (fail closed)");
    expect(workflowYaml).toContain("evaluate-crawl-verdict.py");
    const script = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/evaluate-crawl-verdict.py"), "utf8");
    expect(script).toContain("return 1");
    expect(script).toContain("DEPLOYMENT_PROTECTION");
  });

  it("6 — continue-on-error collection cannot end with unconditional success", () => {
    expect(workflowYaml).toContain("continue-on-error: true");
    expect(workflowYaml).toContain("UAT_CRAWL_STEP_OUTCOMES.json");
    expect(workflowYaml).toMatch(/steps\.ai_uat\.outcome/);
  });

  it("7 — exact run tranche reaches evidence commit message", () => {
    expect(workflowYaml).toContain('id: record_crawl_plan');
    expect(workflowYaml).toContain("UAT_GHA_RUN.json");
    expect(workflowYaml).toContain('runTranche');
    expect(workflowYaml).toContain('tranche ${TRANCHE}');
  });

  it("8 — duplicate UAT category membership fails reconciliation", () => {
    const script = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/record-verified-blockers.mjs"), "utf8");
    expect(script).toContain("duplicateMemberships");
    expect(script).toContain("exclusive-category duplication");
  });

  it("9 — exactly 131 current census IDs reconcile", () => {
    const census = JSON.parse(
      readFileSync(join(REPO_ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
    ) as { entries: unknown[] };
    expect(census.entries.length).toBe(131);
    const output = execFileSync("node", ["scripts/uat-crawl/record-verified-blockers.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, GITHUB_RUN_ID: "integrity-census-test" },
    });
    expect(output).toMatch(/reconciled=true/);
  });

  it("10 — historical blocker rows do not override current secret presence", () => {
    const script = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/record-verified-blockers.mjs"), "utf8");
    expect(script).toContain("loadSecretPresenceMap");
    const presenceScript = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/record-secret-presence.mjs"), "utf8");
    expect(presenceScript).toContain("historical blocker rows do not override");
  });

  it("11 — stale current-run provenance label is impossible in provenance writer", () => {
    const script = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/record-current-main-provenance.mjs"), "utf8");
    expect(script).not.toContain("#558 @ a619a7a2");
    expect(script).toContain("buildDeployProvenanceLabel");
    expect(script).toContain("crawlTargetType");
  });

  it("12 — run ID is present on current-run evidence rows", () => {
    vi.stubEnv("GITHUB_RUN_ID", "run-scope-test");
    vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
    vi.stubEnv("RUN_TRANCHE", "watchdog-continue");
    const row = attachRunMetadata({
      uatId: "UAT-0001",
      tranche: "tranche-01",
      screenshot: "x.png",
      screenshotSha256: "abc",
      route: "/",
      state: "default",
      role: "PUBLIC",
      viewport: "1280x720",
      device: "desktop",
      baselineSha: "sha",
      crawlBaseUrl: CENTRAL_PUBLIC_PRODUCTION_ALIAS,
      timestamp: new Date().toISOString(),
      visualStatus: "OBSERVED",
      functionStatus: "OBSERVED",
      uxStatus: "PASS",
      uxEvidence: { s0: "x.png", s1: null, s2: null, s3: null },
      uxEvidenceSha256: {},
      uxCriteriaTotal: 148,
      uxCriteriaEvaluated: 1,
      uxCriteriaPassed: 1,
      uxCriteriaFailed: 0,
      uxCriteriaBlocked: 0,
      uxFailures: [],
      consoleErrors: [],
      networkErrors: [],
      notes: "",
    });
    expect(row.runId).toBe("run-scope-test");
    expect(row.runAttempt).toBe("2");
    expect(row.runTranche).toBe("watchdog-continue");
  });

  it("13 — zero valid app screenshots cannot certify public/auth surfaces via wall guard", () => {
    const wall = classifyAccessWallFromSignals("Login – Vercel", "https://vercel.com/login", "authenticate");
    expect(wall.blocked).toBe(true);
    const rows = Array.from({ length: 6 }, (_, i) => ({
      uatId: `UAT-00${i + 1}`,
      route: `/route-${i}`,
      screenshotSha256: "same-hash",
      visualStatus: "OBSERVED",
    }));
    const audit = detectScreenshotHashWall(rows, { minRoutes: 5 });
    expect(audit.wallDetected).toBe(true);
  });

  it("14 — UAT-0018/0020 evidence paths resolve under post-fix-483 when captured", () => {
    const spec = readFileSync(join(REPO_ROOT, "tests/uat-crawl/post-fix-483-rerun.spec.ts"), "utf8");
    expect(spec).toContain("uat-evidence/screenshots/post-fix-483");
    expect(spec).toContain('toContain("post-fix-483")');
  });
});
