/**
 * Point100 upstream macro dependencies — fail-closed registry for open PRs that
 * must not be shadowed by Central disposable bootstrap or preview fallbacks.
 */

import type { Point100CapabilityStatus } from "./capabilityStatus";

export type UpstreamDependencyState =
  | "open_pr"
  | "merged"
  | "physical_uat_only"
  | "production_migration_pending";

export type Point100UpstreamDependency = {
  id: string;
  repository: string;
  pr: string;
  state: UpstreamDependencyState;
  affectedStageIds: readonly string[];
  blockerDetail: string;
  failClosedStatus: Point100CapabilityStatus;
  /** When true, blocker applies to production certification only; disposable rehearsal may proceed. */
  disposableRehearsalBypass?: boolean;
};

/** Production-certified Core boundary — current protected production release after Trace reprint authority #290. */
export const POINT100_CORE_PRODUCTION_VERIFIED_SHA = "7b2a09d4a70ee9632c264b552c3265f2495ce48a";

export const POINT100_PRODUCTION_MIGRATION_GATE = "oasis-supabase-core#182";

/** GitHub Actions run certifying exact-SHA deploy, semantic parity and production contract smoke for the current protected release. */
export const POINT100_PRODUCTION_MIGRATION_RUN_ID = "34661721779";

/** Governed Trace software contracts shipped on Core #259 and consumed by merged Trace #37. */
export const POINT100_TRACE_SOFTWARE_RPCS = [
  "trace_verify_handover_evidence_v1",
  "trace_sign_handover_evidence_v1",
  "trace_allocate_identity_v1",
] as const;

/** Canonical Core dispatch-finalize authority delivered by #260 and retained on the current production pin. */
export const POINT100_DISPATCH_FINALIZE_RPC = "release_order_to_dispatched_v1";

/** Retained as provenance for capability-matrix compatibility; #260 is merged and production-certified. */
export const POINT100_CORE_PENDING_DISPATCH_PR = "#260";

/**
 * Optional explicit recertification run override. The canonical default is the current protected production release.
 */
export const POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID_ENV = "POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID";

/** No Core RPC remains pending on the certified production pin. */
const POINT100_PENDING_CORE_RPCS = new Set<string>();

import { POINT100_UPSTREAM_DEPENDENCIES } from "./upstreamDependencyRegistry";

export { POINT100_UPSTREAM_DEPENDENCIES };

export function resolveCoreVerifiedSha(): string | null {
  return process.env.POINT100_CORE_VERIFIED_SHA?.trim() ?? null;
}

export function resolveProductionMigrationRunId(): string | null {
  return process.env.POINT100_PRODUCTION_MIGRATION_RUN_ID?.trim() ?? POINT100_PRODUCTION_MIGRATION_RUN_ID;
}

export function isCoreProductionVerified(): boolean {
  const sha = resolveCoreVerifiedSha()?.toLowerCase();
  return sha === POINT100_CORE_PRODUCTION_VERIFIED_SHA;
}

/** Dispatch authority is part of the current production-certified Core pin. */
export function isCoreDispatchProductionVerified(): boolean {
  return isCoreProductionVerified();
}

export function resolveRecertAfterCoreMigrationRunId(): string | null {
  return process.env.POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID?.trim() ?? POINT100_PRODUCTION_MIGRATION_RUN_ID;
}

/** RPCs injected by disposable cert bootstrap must not satisfy certified-pin probes. */
export function isRpcOnCertifiedCorePin(rpcName: string): boolean {
  if (POINT100_PENDING_CORE_RPCS.has(rpcName)) return false;
  return true;
}

/** @deprecated Use isCoreProductionVerified */
export function isCoreInventoryProductionVerified(): boolean {
  return isCoreProductionVerified();
}

export function isProductionCertificationPermitted(): boolean {
  return process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED === "true";
}

export function isDisposableCertBootstrapPermitted(): boolean {
  return process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP === "true";
}

export function isDisposableRehearsalMode(): boolean {
  return isDisposableCertBootstrapPermitted() && !isProductionCertificationPermitted();
}

function isSoftwareUpstreamState(state: UpstreamDependencyState): boolean {
  return state !== "merged" && state !== "physical_uat_only" && state !== "production_migration_pending";
}

function isDependencyActiveForStage(
  dep: Point100UpstreamDependency,
  stageId: string,
): boolean {
  if (!isSoftwareUpstreamState(dep.state)) return false;
  if (!dep.affectedStageIds.includes(stageId)) return false;
  if (dep.disposableRehearsalBypass && isDisposableRehearsalMode()) return false;
  return true;
}

export function upstreamBlockersForStage(stageId: string): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter((dep) => isDependencyActiveForStage(dep, stageId));
}

/** External / physical / provider evidence gates — not software upstream blockers. */
export function productionGateBlockers(): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter(
    (dep) => dep.state === "physical_uat_only" || dep.state === "production_migration_pending",
  );
}

export function formatUpstreamBlocker(dep: Point100UpstreamDependency): string {
  return `${dep.repository}${dep.pr}: ${dep.blockerDetail}`;
}
