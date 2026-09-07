import { test, expect } from "@playwright/test";
import {
  assertNoSilentSkips,
  credentialsForRoleOrSkip,
  hasPoint100HarnessEnv,
  loginToFactoryCertificationTarget,
  recordStage,
  writeCapabilityMatrix,
  writeDressRehearsalLedger,
} from "./support";
import { runLifecycleProbes } from "./probes";

/**
 * POINT100 — CAPABILITY / BLOCKER MATRIX
 *
 * Generates point100-capability-matrix.json from executable probes across the
 * full operational lifecycle. Never silently skips: missing env causes explicit
 * preview_secret_missing status, not omission.
 */

test.describe.configure({ mode: "serial" });

test("POINT100 :: generate capability/blocker matrix from executable probes", async ({ page }) => {
  test.skip(!hasPoint100HarnessEnv(), "CERTIFICATION_ENV_REQUIRED: Point100 harness backend/target missing");

  const admin = credentialsForRoleOrSkip("ADMIN");
  await loginToFactoryCertificationTarget(page, admin);

  const probes = await runLifecycleProbes();
  writeCapabilityMatrix(probes);

  const matrixStages: import("./support").Point100StageRecord[] = [];
  for (const probe of probes) {
    recordStage(
      matrixStages,
      probe.stageId,
      probe.coreRpc,
      null,
      null,
      probe.executable ? "PASS" : "BLOCKED",
      probe.detail,
    );
  }

  const ledger = writeDressRehearsalLedger({
    schema_version: 1,
    harness: "point100-dress-rehearsal",
    environment: process.env.FACTORY_CERT_ENVIRONMENT_ID?.trim() ?? "disposable-local-core",
    production_accessed: false,
    run_token: `matrix-${Date.now()}`,
    capability_matrix_file: "point100-capability-matrix.json",
    stages: matrixStages,
    negative_paths: [],
    upstream_blockers: probes
      .filter((probe) => probe.status === "upstream_contract_missing")
      .map((probe) => `${probe.stageId}: ${probe.detail}`),
  });

  expect(probes.length).toBe(16);
  expect(probes.every((probe) => probe.status)).toBe(true);
  assertNoSilentSkips(ledger);

  const implemented = probes.filter((p) => p.status === "implemented").length;
  const physicalOnly = probes.filter((p) => p.status === "physical_uat_only").length;
  expect(implemented + physicalOnly).toBeGreaterThan(0);

  // Fail closed only when zero stages are technically probeable — matrix must still be written.
  const executable = probes.filter((p) => p.executable).length;
  const probeable = probes.filter((p) => p.status !== "preview_secret_missing").length;
  expect(probeable, "capability matrix must probe all stages without silent omission").toBe(16);
  expect(executable, "at least one lifecycle stage must be executable in disposable env").toBeGreaterThan(0);
});
