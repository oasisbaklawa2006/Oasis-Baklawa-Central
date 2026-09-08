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
import { POINT100_CORE_PRODUCTION_VERIFIED_SHA, POINT100_PRODUCTION_MIGRATION_GATE, isCoreInventoryProductionVerified, isProductionCertificationPermitted, resolveCoreVerifiedSha } from "../../src/lib/point100/upstreamDependencies";

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
  certification_mode: "disposable_synthetic" | "production";
  production_certification_permitted: boolean;
  production_migration_gate: string | null;
  core_verified_sha: string | null;
  inventory_production_verified: boolean;
  run_token: string;
  generated_at: string;
  capability_matrix_file: string;
  stages: Point100StageRecord[];
  negative_paths: Point100StageRecord[];
  upstream_blockers: string[];
  production_gate_blockers: string[];
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

/** Canonical PF-6A payment proof payload aligned with Core main contract. */
export function buildPaymentProofPayload(input: {
  orderId: string;
  piId: string;
  commercialVersionId: string;
  amount: number;
  actorId: string;
  runSuffix: string;
  scope: string;
}) {
  const identity = `${input.scope}-${input.runSuffix}`;
  return {
    p_order_id: input.orderId,
    p_pi_id: input.piId,
    p_commercial_version_id: input.commercialVersionId,
    p_payment_type: "advance" as const,
    p_submitted_amount: input.amount,
    p_currency: "INR",
    p_payment_mode: "bank_transfer" as const,
    p_external_reference: `POINT100-${input.runSuffix}`,
    p_payer_reference: null,
    p_proof_evidence_reference: `point100:${input.scope}:${input.runSuffix}`,
    p_source_channel: "CENTRAL",
    p_source_reference: `point100:${input.orderId}`,
    p_correlation_id: `central:pf6a:proof:${identity}`,
    p_idempotency_key: `central:pf6a:proof:${identity}`,
    p_actor_id: input.actorId,
  };
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
  ledger: Omit<Point100DressRehearsalLedger, "generated_at" | "status" | "certification_mode" | "production_certification_permitted" | "production_migration_gate" | "core_verified_sha" | "inventory_production_verified" | "production_gate_blockers"> & {
    production_gate_blockers?: string[];
  },
): Point100DressRehearsalLedger {
  const failedStages = ledger.stages.filter((s) => s.status === "FAIL");
  const failedNegative = ledger.negative_paths.filter((s) => s.status === "FAIL");
  const productionGateBlockers = ledger.production_gate_blockers ?? [];
  const blocked =
    ledger.stages.some((s) => s.status === "BLOCKED") ||
    ledger.upstream_blockers.length > 0 ||
    productionGateBlockers.length > 0;
  const summary: Point100DressRehearsalLedger = {
    ...ledger,
    certification_mode: isProductionCertificationPermitted() ? "production" : "disposable_synthetic",
    production_certification_permitted: isProductionCertificationPermitted(),
    production_migration_gate: isCoreInventoryProductionVerified() ? POINT100_PRODUCTION_MIGRATION_GATE : null,
    core_verified_sha: resolveCoreVerifiedSha(),
    inventory_production_verified: isCoreInventoryProductionVerified(),
    production_gate_blockers: productionGateBlockers,
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
  const hint = String((error as { hint?: string }).hint ?? "");
  if (hint.toLowerCase().includes("perhaps you meant to call")) {
    return { exists: true, detail: hint || message };
  }
  if (message.toLowerCase().includes("could not find the function")) {
    if (message.includes(rpcName)) {
      return { exists: true, detail: message };
    }
    return { exists: false, detail: message };
  }
  if (message.includes("PGRST202")) {
    return { exists: message.includes(rpcName), detail: message };
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
  loginToFactoryCertificationTarget,
};
