/**
 * Point100 capability / blocker vocabulary — machine-readable probe outcomes.
 * Distinct from programme CLEARED status; describes executable harness state only.
 */

import { POINT100_CORE_PRODUCTION_VERIFIED_SHA, POINT100_PRODUCTION_MIGRATION_GATE, POINT100_UPSTREAM_DEPENDENCIES, isCoreInventoryProductionVerified, isProductionCertificationPermitted, resolveCoreVerifiedSha } from "./upstreamDependencies";

export type Point100CapabilityStatus =
  | "implemented"
  | "upstream_contract_missing"
  | "preview_secret_missing"
  | "provider_runtime_missing"
  | "physical_uat_only";

export type Point100ProbeOutcome = {
  stageId: string;
  status: Point100CapabilityStatus;
  centralBinding: string | null;
  coreRpc: string | null;
  detail: string;
  probeAt: string;
  executable: boolean;
};

export type Point100CapabilityMatrix = {
  schema_version: 1;
  harness: "point100-dress-rehearsal";
  generated_at: string;
  environment_id: string | null;
  fail_closed: true;
  certification_mode: "disposable_synthetic" | "production";
  production_certification_permitted: boolean;
  production_migration_gate: string | null;
  core_verified_sha: string | null;
  inventory_production_verified: boolean;
  upstream_dependencies: Array<{
    id: string;
    repository: string;
    pr: string;
    state: string;
    blockerDetail: string;
  }>;
  summary: {
    total: number;
    implemented: number;
    upstream_contract_missing: number;
    preview_secret_missing: number;
    provider_runtime_missing: number;
    physical_uat_only: number;
    executable_stages: number;
  };
  probes: Point100ProbeOutcome[];
};

export function summarizeCapabilityMatrix(probes: Point100ProbeOutcome[]): Point100CapabilityMatrix["summary"] {
  const counts = {
    total: probes.length,
    implemented: 0,
    upstream_contract_missing: 0,
    preview_secret_missing: 0,
    provider_runtime_missing: 0,
    physical_uat_only: 0,
    executable_stages: 0,
  };
  for (const probe of probes) {
    counts[probe.status] += 1;
    if (probe.executable) counts.executable_stages += 1;
  }
  return counts;
}

export function buildCapabilityMatrix(
  probes: Point100ProbeOutcome[],
  environmentId: string | null,
): Point100CapabilityMatrix {
  return {
    schema_version: 1,
    harness: "point100-dress-rehearsal",
    generated_at: new Date().toISOString(),
    environment_id: environmentId,
    fail_closed: true,
    certification_mode: isProductionCertificationPermitted() ? "production" : "disposable_synthetic",
    production_certification_permitted: isProductionCertificationPermitted(),
    production_migration_gate: isCoreInventoryProductionVerified() ? POINT100_PRODUCTION_MIGRATION_GATE : null,
    core_verified_sha: resolveCoreVerifiedSha(),
    inventory_production_verified: isCoreInventoryProductionVerified(),
    upstream_dependencies: POINT100_UPSTREAM_DEPENDENCIES
      .filter((dep) => dep.state !== "merged")
      .map((dep) => ({
        id: dep.id,
        repository: dep.repository,
        pr: dep.pr,
        state: dep.state,
        blockerDetail: dep.blockerDetail,
      })),
    summary: summarizeCapabilityMatrix(probes),
    probes,
  };
}
