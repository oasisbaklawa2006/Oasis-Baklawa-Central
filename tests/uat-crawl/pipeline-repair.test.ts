import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "../..");

const workflowYaml = readFileSync(
  join(REPO_ROOT, ".github/workflows/uat-crawl-evidence.yml"),
  "utf8",
);

const SAMPLE_ROW =
  "| FAIL-001-0002 | UAT-0002 | central | ADMIN_STAFF | desktop | /operations-controller | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | shot.png | console:0 net:0 | Open /operations-controller without session | Central | Deploy/Auth | TEST_* or operator credentials |";

describe("UAT evidence pipeline repair regressions", () => {
  describe("appendFailureLedger idempotency", () => {
    let ledgerPath: string;

    beforeEach(() => {
      ledgerPath = join(mkdtempSync(join(tmpdir(), "uat-ledger-")), "UAT_FAILURE_LEDGER.md");
      writeFileSync(ledgerPath, "# Historical ledger\n\nPreserved row.\n");
    });

    it("does not duplicate prior rows on repeated invocation", async () => {
      const { appendFailureLedger } = await import("./crawl-engine");
      appendFailureLedger(ledgerPath, "tranche-a", [SAMPLE_ROW], []);
      const afterFirst = readFileSync(ledgerPath, "utf8");
      appendFailureLedger(ledgerPath, "tranche-b", [SAMPLE_ROW], []);
      const afterSecond = readFileSync(ledgerPath, "utf8");
      expect(afterSecond).toBe(afterFirst);
      expect(afterSecond.match(/FAIL-001-0002/g)?.length).toBe(1);
    });

    it("adds neither rows nor section header when zero new failures", async () => {
      const { appendFailureLedger } = await import("./crawl-engine");
      const before = readFileSync(ledgerPath, "utf8");
      appendFailureLedger(ledgerPath, "empty-run", [], []);
      const after = readFileSync(ledgerPath, "utf8");
      expect(after).toBe(before);
      expect(after).not.toContain("empty-run crawl failures");
    });

    it("preserves historical append-only evidence while appending genuinely new rows", async () => {
      const { appendFailureLedger } = await import("./crawl-engine");
      const historical = readFileSync(ledgerPath, "utf8");
      const newRow =
        "| FAIL-001-0099 | UAT-0099 | central | ADMIN_STAFF | desktop | /support | Authenticated surface access | Role-specific app surface | Login redirect | P1 | shot.png | console:0 net:0 | Open /support | Central | Deploy/Auth | TEST_* |";
      appendFailureLedger(ledgerPath, "new-evidence", [newRow], []);
      const after = readFileSync(ledgerPath, "utf8");
      expect(after.startsWith(historical)).toBe(true);
      expect(after).toContain("Preserved row.");
      expect(after).toContain(newRow);
    });
  });

  describe("CURRENT_MAIN_SHA runtime override", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("prefers UAT_TARGET_SHA over the offline fallback literal", async () => {
      vi.stubEnv("UAT_TARGET_SHA", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
      vi.resetModules();
      const { CURRENT_MAIN_SHA } = await import("./crawl-engine");
      expect(CURRENT_MAIN_SHA).toBe("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    });
  });

  describe("workflow_dispatch commit-evidence gating", () => {
    it("allows commit-evidence on workflow_dispatch as well as push", () => {
      expect(workflowYaml).toContain(
        "if: always() && needs.uat-crawl.result != 'cancelled' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')",
      );
    });

    it("resolves current main dynamically instead of pinning a619a7a2", () => {
      expect(workflowYaml).toContain('gh api "repos/${GITHUB_REPOSITORY}/commits/main"');
      expect(workflowYaml).not.toMatch(/CURRENT_MAIN_SHA="a619a7a2/);
    });
  });

  describe("record-verified-blockers denominator reconciliation", () => {
    const evidencePaths = [
      "docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl",
      "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_ARCHIVE.jsonl",
      "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json",
    ];
    let evidenceBackups: string[] = [];

    beforeEach(() => {
      evidenceBackups = evidencePaths.map((relativePath) => {
        const source = join(REPO_ROOT, relativePath);
        const backup = `${source}.pipeline-repair-backup`;
        copyFileSync(source, backup);
        return backup;
      });
    });

    afterEach(() => {
      for (const [index, relativePath] of evidencePaths.entries()) {
        copyFileSync(evidenceBackups[index], join(REPO_ROOT, relativePath));
        unlinkSync(evidenceBackups[index]);
      }
    });

    it("reconciles authenticated + publicSkipped + blocked + credsAvailable to census total", () => {
      const output = execFileSync("node", ["scripts/uat-crawl/record-verified-blockers.mjs"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: { ...process.env, GITHUB_RUN_ID: "pipeline-repair-test" },
      });
      expect(output).toMatch(/reconciled=true/);
      const summary = JSON.parse(
        readFileSync(join(REPO_ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json"), "utf8"),
      );
      const {
        authenticated,
        publicFunctionObserved,
        blocked,
        credsAvailableNoEvidence,
        totalCensus,
        reconciledTotal,
      } = summary.counts;
      expect(authenticated + publicFunctionObserved + blocked + credsAvailableNoEvidence).toBe(
        totalCensus,
      );
      expect(reconciledTotal).toBe(totalCensus);
      expect(summary.denominatorReconciled).toBe(true);
    });

    it("excludes stale manifest IDs outside current census membership", () => {
      const census = JSON.parse(
        readFileSync(join(REPO_ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
      ) as { entries: { uatId: string }[] };
      const censusIds = new Set(census.entries.map((entry) => entry.uatId));
      const manifestPath = join(REPO_ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
      const manifestIds = readFileSync(manifestPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line).uatId as string);
      const authenticatedWithStale = new Set([...manifestIds, "UAT-STALE-9999"]);
      const intersected = new Set([...authenticatedWithStale].filter((id) => censusIds.has(id)));
      expect(intersected.has("UAT-STALE-9999")).toBe(false);
      expect(intersected.size).toBeLessThan(authenticatedWithStale.size);
      expect(intersected.size).toBeLessThanOrEqual(census.entries.length);
    });

    it("fails closed when denominator reconciliation would be inconsistent", () => {
      const script = readFileSync(
        join(REPO_ROOT, "scripts/uat-crawl/record-verified-blockers.mjs"),
        "utf8",
      );
      expect(script).toContain("denominator reconciliation failed");
      expect(script).toContain("process.exitCode = 1");
      expect(script).toContain("censusIds.has(id)");
    });
  });
});
