import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DATA_FIXTURE_GATE,
  TEST_CREDENTIAL_GATE,
  isDataFixtureGateRow,
  inferTestCredentialGate,
} from "../../scripts/uat-crawl/classification-helpers.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "../..");
const RUN_ID = "36450858295";

describe("UAT fixture-gate evidence truth repair (run 36450858295)", () => {
  it("classifies authenticated post-fix S0 + missing fixture as DATA_FIXTURE_GATE", () => {
    const manifest = readFileSync(
      join(REPO_ROOT, "docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((row) => row.runId === RUN_ID);

    for (const uatId of ["UAT-0018", "UAT-0020"]) {
      const row = manifest.find((entry) => entry.uatId === uatId);
      expect(row, uatId).toBeTruthy();
      expect(row.authenticated).toBe(true);
      expect(row.uxEvidence?.s0).toBeTruthy();
      expect(row.uxEvidence?.s3).toBeNull();
      expect(isDataFixtureGateRow(row)).toBe(true);
      expect(row.retestDisposition?.["FAIL-481-001"]).toBe("BLOCKED");
    }
  });

  it("classifies UAT-0106 Supabase 400 as TEST_CREDENTIAL_GATE not generic auth-flow failure", () => {
    const row = readFileSync(join(REPO_ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find((entry) => entry.uatId === "UAT-0106" && entry.runId === RUN_ID);
    expect(row).toBeTruthy();
    expect(row.credentialPrefix).toBe("TEST_TV_PRODUCTION");
    expect(inferTestCredentialGate(row)).toBe(TEST_CREDENTIAL_GATE);
  });

  it("record-verified-blockers reconciles fixture/credential gates without creds-available or auth-flow miscounts", () => {
    execFileSync("node", ["scripts/uat-crawl/record-verified-blockers.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, GITHUB_RUN_ID: RUN_ID },
    });
    const summary = JSON.parse(
      readFileSync(join(REPO_ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json"), "utf8"),
    );
    expect(summary.runId).toBe(RUN_ID);
    expect(summary.counts.dataFixtureGate).toBe(2);
    expect(summary.counts.testCredentialGate).toBe(1);
    expect(summary.counts.credsAvailableNoEvidence).toBe(0);
    expect(summary.counts.authFlowFailed).toBe(0);
    expect(summary.counts.notExecuted).toBe(10);
    expect(summary.denominatorReconciled).toBe(true);
  });

  it("physical readiness reconciliation propagates DATA_FIXTURE_GATE and TEST_CREDENTIAL_GATE", () => {
    execFileSync("node", ["scripts/uat-crawl/generate-physical-readiness-reconciliation.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_RUN_ID: RUN_ID,
        UAT_TARGET_SHA: "4e16ae5f434cdeb4449e077a50c828a89e51316c",
        UAT_CRAWL_BASE_URL: "https://oasis-baklawa-central.vercel.app",
      },
    });
    const payload = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "docs/uat-crawl/UAT_PHYSICAL_READINESS_RECONCILIATION.json"),
        "utf8",
      ),
    );
    expect(payload.runId).toBe(RUN_ID);
    expect(payload.counts.dataFixtureGate).toBe(2);
    expect(payload.counts.testCredentialGate).toBe(1);
    expect(payload.counts.notExecuted).toBe(10);

    const byId = new Map(payload.rows.map((row: { uatId: string }) => [row.uatId, row]));
    expect(byId.get("UAT-0018")?.disposition).toBe(DATA_FIXTURE_GATE);
    expect(byId.get("UAT-0020")?.disposition).toBe(DATA_FIXTURE_GATE);
    expect(byId.get("UAT-0106")?.disposition).toBe(TEST_CREDENTIAL_GATE);
    expect(byId.get("UAT-0018")?.disposition).not.toBe("AUTH_S0_S3_COMPLETE");
  });

  it("evaluate-crawl-verdict treats fixture/credential gates as warnings not creds-available failures", () => {
    execFileSync("node", ["scripts/uat-crawl/record-verified-blockers.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, GITHUB_RUN_ID: RUN_ID },
    });
    execFileSync("node", ["scripts/uat-crawl/generate-physical-readiness-reconciliation.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_RUN_ID: RUN_ID,
        UAT_TARGET_SHA: "4e16ae5f434cdeb4449e077a50c828a89e51316c",
        UAT_CRAWL_BASE_URL: "https://oasis-baklawa-central.vercel.app",
      },
    });
    try {
      execFileSync("python3", ["scripts/uat-crawl/evaluate-crawl-verdict.py"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_RUN_ID: RUN_ID,
          RUN_TRANCHE: "watchdog-continue",
          UAT_DEPLOY_BLOCKED: "false",
        },
      });
    } catch {
      // Expected fail-closed while NOT_EXECUTED census rows remain on run 36450858295.
    }
    const verdict = JSON.parse(
      readFileSync(join(REPO_ROOT, "docs/uat-crawl/UAT_CRAWL_VERDICT.json"), "utf8"),
    );
    expect(verdict.failures.some((f: string) => f.startsWith("CREDENTIALS_AVAILABLE"))).toBe(false);
    expect(verdict.failures.some((f: string) => f.startsWith("AUTH_FLOW_FAILED"))).toBe(false);
    expect(verdict.warnings.some((w: string) => w.startsWith("DATA_FIXTURE_GATE_ROWS:"))).toBe(true);
    expect(verdict.warnings.some((w: string) => w.startsWith("TEST_CREDENTIAL_GATE_ROWS:"))).toBe(true);
  });
});
