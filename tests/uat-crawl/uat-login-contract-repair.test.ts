import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUTH_BLOCK_CLASSIFICATIONS,
  authKindForPersona,
  isUnauthenticatedDestination,
  staffLoginPath,
  buyerLoginPath,
} from "../auth/auth-contract";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "../..");
const workflowYaml = readFileSync(join(REPO_ROOT, ".github/workflows/uat-crawl-evidence.yml"), "utf8");
const e2eHelpers = readFileSync(join(REPO_ROOT, "tests/e2e-helpers.ts"), "utf8");
const aiUatRuntime = readFileSync(join(REPO_ROOT, "tests/ai-uat/runtime.ts"), "utf8");
const aiUatSpec = readFileSync(join(REPO_ROOT, "tests/ai-uat/tranche1.spec.ts"), "utf8");
const authCrawl = readFileSync(join(REPO_ROOT, "tests/uat-crawl/auth-crawl.ts"), "utf8");
const buyerMobile = readFileSync(join(REPO_ROOT, "tests/uat-crawl/buyer-mobile-crawl.ts"), "utf8");
const authContract = readFileSync(join(REPO_ROOT, "tests/auth/auth-contract.ts"), "utf8");
const blockersScript = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/record-verified-blockers.mjs"), "utf8");
const reconciliationScript = readFileSync(
  join(REPO_ROOT, "scripts/uat-crawl/generate-physical-readiness-reconciliation.mjs"),
  "utf8",
);
const verdictScript = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/evaluate-crawl-verdict.py"), "utf8");
const trancheAuthRange = readFileSync(join(REPO_ROOT, "tests/uat-crawl/tranche-auth-range.spec.ts"), "utf8");
const credentialMatrix = readFileSync(join(REPO_ROOT, "tests/uat-crawl/credential-matrix.ts"), "utf8");
const rebaselineScript = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/record-rebaseline-current-main.mjs"), "utf8");
const authGateLoader = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/load-auth-gate-by-id.py"), "utf8");
const screenshotWallScript = readFileSync(join(REPO_ROOT, "scripts/uat-crawl/detect-screenshot-wall.py"), "utf8");

describe("UAT login contract repair regressions", () => {
  it("1 — staff roles do not route through BuyerLogin", () => {
    expect(authKindForPersona("DISPATCH")).toBe("staff");
    expect(authKindForPersona("ADMIN_STAFF")).toBe("staff");
    expect(authKindForPersona("BUYER")).toBe("buyer");
    expect(aiUatRuntime).toContain("loginStaff");
    expect(aiUatRuntime).not.toContain('login(page, email, password)');
    expect(e2eHelpers).toContain("loginStaff");
    expect(e2eHelpers).toContain("loginBuyer");
  });

  it("2 — DISPATCH_MANAGER UAT-001 uses staff auth path", () => {
    expect(aiUatSpec).toContain("TEST_DISPATCH");
    expect(aiUatRuntime).toContain("loginStaff");
    expect(staffLoginPath()).toBe("/staff/login");
  });

  it("3 — buyer auth targets current BuyerLogin contract", () => {
    expect(buyerLoginPath()).toBe("/buyer/login");
    expect(buyerMobile).toContain("loginBuyer");
    expect(authContract).toContain("B2B Client Login");
  });

  it("4 — obsolete Welcome Back selector is not the universal login contract", () => {
    expect(e2eHelpers).not.toContain('name: /Welcome Back/i');
    expect(aiUatSpec).not.toContain("Welcome Back");
    expect(authCrawl).toContain("loginForPersona");
  });

  it("5 — empty missingSecretNames cannot produce MISSING_SECRET classification in blockers", () => {
    expect(blockersScript).toContain('blockClassification: "MISSING_SECRET"');
    expect(blockersScript).toContain("if (missing.length === 0)");
    expect(blockersScript).toContain("authFlowFailed");
    expect(blockersScript).toContain("AUTH_CONTRACT_MISMATCH");
  });

  it("6 — OTP/provider-gated buyer auth is classified separately from application defect", () => {
    expect(authContract).toContain("OTP_EXTERNAL_GATE");
    expect(authContract).toContain("PROVIDER_GATED");
    expect(buyerMobile).toContain("blockClassification");
    expect(buyerMobile).toContain("loginResult.classification");
    expect(blockersScript).toContain("otpExternalGate");
    expect(AUTH_BLOCK_CLASSIFICATIONS.OTP_EXTERNAL_GATE).toBe("OTP_EXTERNAL_GATE");
  });

  it("7 — one AI-UAT failure does not prevent independent cases from running", () => {
    expect(aiUatSpec).not.toContain('mode: "serial"');
    expect(aiUatSpec).toContain("Independent cases must continue");
  });

  it("8 — final verdict still fails closed when material cases fail", () => {
    expect(workflowYaml).toContain("Aggregate crawl certification verdict (fail closed)");
    expect(verdictScript).toContain("AI_UAT_SUITE_FAILED");
    expect(verdictScript).toContain("return 1");
  });

  it("9 — current reconciliation is regenerated and committed per crawl", () => {
    expect(workflowYaml).toContain("Generate physical readiness reconciliation (current run)");
    expect(workflowYaml).toContain("UAT_PHYSICAL_READINESS_RECONCILIATION.json");
    expect(reconciliationScript).toContain("runAttempt");
    expect(reconciliationScript).toContain("runTranche");
  });

  it("10 — UAT_CRAWL_STEP_OUTCOMES.json is persisted to artifact + commit", () => {
    expect(workflowYaml).toContain("UAT_CRAWL_STEP_OUTCOMES.json");
    expect(workflowYaml).toContain("Write crawl step outcomes for verdict");
  });

  it("11 — UAT_CRAWL_VERDICT.json is persisted alongside certification verdict", () => {
    expect(verdictScript).toContain("UAT_CRAWL_VERDICT.json");
    expect(workflowYaml).toContain("UAT_CRAWL_VERDICT.json");
    expect(workflowYaml).toContain("UAT_CRAWL_CERTIFICATION_VERDICT.json");
  });

  it("12 — unauthenticated destinations use route/session assertions", () => {
    expect(isUnauthenticatedDestination("/login")).toBe(true);
    expect(isUnauthenticatedDestination("/staff/login")).toBe(true);
    expect(isUnauthenticatedDestination("/buyer/login")).toBe(true);
    expect(isUnauthenticatedDestination("/admin/dispatch-mgmt")).toBe(false);
    expect(aiUatSpec).toContain("expectUnauthenticatedSession");
  });

  it("13 — lazy split-auth surfaces settle before contract classification", () => {
    expect(authContract).toContain("AUTH_SURFACE_SETTLE_TIMEOUT_MS");
    expect(authContract).toContain('toBeVisible({ timeout })');
    expect(authContract).toContain("Authentication entry must render before architecture detection");
    expect(authContract).toContain("waitForVisibleHeading(page, STAFF_HEADING)");
    expect(authContract).toContain("waitForVisibleHeading(page, BUYER_HEADING)");
  });

  it("14 — protected-route denial waits for auth/role hydration redirect", () => {
    expect(authContract).toContain("ROUTE_GUARD_SETTLE_TIMEOUT_MS");
    expect(authContract).toContain("waitForUnauthenticatedDestination");
    expect(authContract).toContain("isUnauthenticatedDestination(new URL(page.url()).pathname)");
    expect(aiUatSpec).toContain("waitForUnauthenticatedDestination(page, context)");
  });

  it("15 — evidence-branch pushes default to auth-contract-smoke; commit message can request watchdog-continue or post-fix-483", () => {
    expect(workflowYaml).toContain("auth-contract-smoke");
    expect(workflowYaml).toContain("UAT watchdog-continue");
    expect(workflowYaml).toContain("UAT post-fix-483");
    expect(workflowYaml).toContain("|| 'auth-contract-smoke'");
    expect(workflowYaml).toContain("env.RUN_TRANCHE == 'auth-contract-smoke'");
  });

  it("16 — authenticated tranche has a separate budget longer than the 120-second login wait", () => {
    expect(trancheAuthRange).toContain("AUTH_CRAWL_TEST_TIMEOUT_MS = 240_000");
    expect(trancheAuthRange).not.toContain('mode: "serial"');
  });

  it("17 — TV evidence records the actual 1920x1080 viewport", () => {
    expect(trancheAuthRange).toContain('target.device === "tv" ? "1920x1080"');
    expect(trancheAuthRange).toContain('target.device === "tv" ? "tv-1080p"');
  });

  it("18 — TV routes use role-appropriate credential prefixes", () => {
    expect(credentialMatrix).toContain('/^\\/tv\\/3pgs/');
    expect(credentialMatrix).toContain('["TEST_3PGS", "TEST_OPERATIONS", "TEST_ADMIN"]');
    expect(credentialMatrix).toContain('/^\\/tv\\/rgs/');
    expect(credentialMatrix).toContain('["TEST_TV_RGS", "TEST_RGS", "TEST_ADMIN"]');
    expect(credentialMatrix).toContain('/^\\/tv\\/arabic-sweets/');
    expect(credentialMatrix).toContain('["TEST_TV_PRODUCTION", "TEST_PRODUCTION", "TEST_ADMIN"]');
    expect(credentialMatrix).toContain('["TEST_ADMIN"]');
  });

  it("19 — final verdict records every watchdog batch, not only five steps", () => {
    for (const id of [
      "credential_prefix_unblock",
      "auth_rerun",
      "tranche_03",
      "tranche_04_auth",
      "tranche_05_auth",
      "tranche_06_auth",
      "tranche_07_auth",
      "tranche_08_auth",
      "buyer_mobile",
      "public_continuation",
      "s2_gap_deepening",
      "reconciliation",
      "screenshot_wall",
    ]) {
      expect(workflowYaml).toContain(id);
      expect(verdictScript).toContain(id);
    }
  });

  it("20 — run #52 missing/stale evidence artifacts are persisted and fail closed", () => {
    for (const file of [
      "UAT_SCREENSHOT_WALL_AUDIT.json",
      "UAT_REBASELINE_CURRENT_MAIN.json",
      "UAT_FAILURE_LEDGER.md",
      "UAT_CURRENT_RUN_SUMMARY.json",
    ]) {
      expect(workflowYaml).toContain(file);
    }
    expect(verdictScript).toContain("SCREENSHOT_WALL_AUDIT_MISSING_OR_STALE");
    expect(verdictScript).toContain("CURRENT_RUN_REBASELINE_MISSING_OR_STALE");
    expect(verdictScript).toContain("CURRENT_RUN_SUMMARY_MISSING_OR_STALE");
  });

  it("21 — current-run certification excludes historical manifest rows", () => {
    expect(rebaselineScript).toContain("row.runId === RUN_ID");
    expect(reconciliationScript).toContain("row.runId === RUN_ID");
    expect(blockersScript).toContain("row.runId !== RUN_ID");
  });

  it("22 — absent current-run evidence is NOT_EXECUTED, not synthetic OTP or credentials-available", () => {
    expect(reconciliationScript).toContain('disposition: "NOT_EXECUTED"');
    expect(blockersScript).toContain('assignCategory(entry.uatId, "notExecuted")');
    expect(authCrawl).toContain('AUTH_BLOCK_CLASSIFICATIONS.NOT_EXECUTED');
    expect(verdictScript).toContain("NOT_EXECUTED_ROWS");
    expect(verdictScript).toContain("CREDENTIALS_AVAILABLE_WITHOUT_EVIDENCE");
  });

  it("23 — helper/audit readers require exact current-run metadata", () => {
    expect(authGateLoader).toContain('row.get("runId") != RUN_ID');
    expect(screenshotWallScript).toContain('row.get("runId") == RUN_ID');
    expect(verdictScript).toContain('row.get("runId") == RUN_ID');
  });

  it("24 — configured cross-app previews are not mislabeled as missing deploy secrets", () => {
    expect(authCrawl).toContain("const deployUrl = process.env[deploySecret]?.trim()");
    expect(authCrawl).toContain('missingDeploy ? "DEPLOY_BLOCKED" : AUTH_BLOCK_CLASSIFICATIONS.NOT_EXECUTED');
    expect(authCrawl).toContain("this Central auth crawler is not the dedicated");
  });
});
