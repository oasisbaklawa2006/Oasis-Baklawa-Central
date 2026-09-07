/**
 * Point100 dress rehearsal harness support — extends factory certification
 * infrastructure with lifecycle orchestration and fail-closed skip semantics.
 */

import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { buildCapabilityMatrix, type Point100ProbeOutcome } from "../../src/lib/point100/capabilityStatus";
import { POINT100_LIFECYCLE_STAGES } from "../../src/lib/point100/lifecycleStages";
import {
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  createAuthenticatedCertificationClient,
  createSteppedUpCertificationClient,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationBackend,
  type FactoryCertificationCredentials,
} from "../factory-certification/support";
import { factoryCertificationCredentialSpec } from "../../src/lib/factoryCertificationCredentialPolicy";

export type Point100StageRecord = {
  stage: string;
  rpc: string | null;
  role: string | null;
  correlation_id: string | null;
  status: "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";
  detail: string;
};

export type Point100DressRehearsalLedger = {
  schema_version: 1;
  harness: "point100-dress-rehearsal";
  status: "PASS" | "FAIL" | "BLOCKED";
  environment: string;
  production_accessed: false;
  run_token: string;
  generated_at: string;
  capability_matrix_file: string;
  stages: Point100StageRecord[];
  negative_paths: Point100StageRecord[];
  upstream_blockers: string[];
};

export function hasPoint100HarnessEnv(): boolean {
  return hasFactoryCertificationTarget() && hasFactoryCertificationBackend();
}

export function requirePoint100HarnessEnv(): void {
  if (!hasPoint100HarnessEnv()) {
    throw new Error(
      "CERTIFICATION_ENV_REQUIRED: POINT100 harness requires FACTORY_CERT_TARGET_URL and FACTORY_CERT_SUPABASE_URL/ANON_KEY",
    );
  }
}

export function credentialsForRoleOrSkip(role: string): FactoryCertificationCredentials {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  return credentials!;
}

export function fixtureOrderId(envKey: string): string {
  const id = process.env[envKey]?.trim();
  if (!id) throw new Error(`CERTIFICATION_FIXTURE_REQUIRED: ${envKey} missing`);
  return id;
}

export async function switchRole(page: Page, credentials: FactoryCertificationCredentials): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // best-effort
    }
  });
  await loginToFactoryCertificationTarget(page, credentials);
}

export function recordStage(
  target: Point100StageRecord[],
  stage: string,
  rpc: string | null,
  role: string | null,
  correlationId: string | null,
  status: Point100StageRecord["status"],
  detail: string,
): void {
  target.push({ stage, rpc, role, correlation_id: correlationId, status, detail });
}

export function writeDressRehearsalLedger(
  ledger: Omit<Point100DressRehearsalLedger, "generated_at" | "status">,
): Point100DressRehearsalLedger {
  const failedStages = ledger.stages.filter((s) => s.status === "FAIL");
  const failedNegative = ledger.negative_paths.filter((s) => s.status === "FAIL");
  const blocked = ledger.stages.some((s) => s.status === "BLOCKED") || ledger.upstream_blockers.length > 0;
  const summary: Point100DressRehearsalLedger = {
    ...ledger,
    generated_at: new Date().toISOString(),
    status: blocked
      ? "BLOCKED"
      : failedStages.length === 0 && failedNegative.length === 0
        ? "PASS"
        : "FAIL",
  };
  writeFileSync("point100-dress-rehearsal-ledger.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

export function writeCapabilityMatrix(probes: Point100ProbeOutcome[]): void {
  const matrix = buildCapabilityMatrix(probes, process.env.FACTORY_CERT_ENVIRONMENT_ID?.trim() ?? null);
  writeFileSync("point100-capability-matrix.json", `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
}

export async function probeRpcExists(rpcName: string): Promise<{ exists: boolean; detail: string }> {
  const backend = resolveFactoryCertificationBackend();
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(backend.url, backend.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.rpc(rpcName as never, {} as never);
  if (!error) return { exists: true, detail: "RPC callable without auth (unexpected but present)" };
  const message = error.message ?? String(error);
  if (
    message.toLowerCase().includes("could not find the function") ||
    message.toLowerCase().includes("does not exist") ||
    message.includes("PGRST202")
  ) {
    return { exists: false, detail: message };
  }
  return { exists: true, detail: message };
}

export function assertNoSilentSkips(ledger: Point100DressRehearsalLedger): void {
  const skipped = ledger.stages.filter((s) => s.status === "SKIPPED");
  expect(skipped, `fail-closed: silent skips are forbidden — ${JSON.stringify(skipped)}`).toHaveLength(0);
}

export const POINT100_STAGE_IDS = POINT100_LIFECYCLE_STAGES.map((stage) => stage.id);

export {
  createAuthenticatedCertificationClient,
  createSteppedUpCertificationClient,
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
};
