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

/** Production-certified Core boundary — Macro Trace Core #259 via Release #161. */
export const POINT100_CORE_PRODUCTION_VERIFIED_SHA = "c89c538c83eeefcd116c67f06bf86869ff63b2e3";

export const POINT100_PRODUCTION_MIGRATION_GATE = "oasis-supabase-core#161";

/** GitHub Actions run certifying semantic parity + production contract smoke for #161. */
export const POINT100_PRODUCTION_MIGRATION_RUN_ID = "34188983863";

/** Governed Trace software contracts shipped on Core #259 (software only — not physical device PASS). */
export const POINT100_TRACE_SOFTWARE_RPCS = [
  "trace_verify_handover_evidence_v1",
  "trace_sign_handover_evidence_v1",
  "trace_allocate_identity_v1",
] as const;

/** Rebind state here when Mission Control clears an upstream macro PR. */
export const POINT100_UPSTREAM_DEPENDENCIES: readonly Point100UpstreamDependency[] = [
  {
    id: "central-macro-ops-556",
    repository: "Oasis-Baklawa-Central",
    pr: "#556",
    state: "merged",
    affectedStageIds: [
      "packing_cartons_dpl",
      "final_invoice_balance",
      "finance_dispatch_clearance",
      "dispatch_consignment",
      "security_gate",
      "customer_dispatch_proof",
    ],
    blockerDetail:
      "Central Order→Factory→Packing→Dispatch→Gate journey merged to main (#556). Point100 binds disposable rehearsal to canonical dispatch workflow routes and clients.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-inventory-macro-256",
    repository: "oasis-supabase-core",
    pr: "#256",
    state: "merged",
    affectedStageIds: ["inventory_lot_allocation", "production_qc"],
    blockerDetail:
      "Macro Inventory #256 merged (ancestor of production pin #259). Lot/putaway/exception/factory RPCs consumed on disposable Core replay at SHA c89c538c.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-production-migration-159",
    repository: "oasis-supabase-core",
    pr: "#159",
    state: "merged",
    affectedStageIds: ["inventory_lot_allocation", "production_qc"],
    blockerDetail:
      "Core Production Migration Release #159 deployed Macro Inventory #256 (superseded as production pin by Release #161 / SHA c89c538c).",
    failClosedStatus: "implemented",
  },
  {
    id: "core-macro-trace-259",
    repository: "oasis-supabase-core",
    pr: "#259",
    state: "merged",
    affectedStageIds: ["trace_handover"],
    blockerDetail:
      "Macro Trace Core #259 server identity + authenticated handover authority merged. Point100 consumes trace_*_v1 software contracts on disposable Core replay — not physical scanner/device PASS.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-production-migration-161",
    repository: "oasis-supabase-core",
    pr: "#161",
    state: "merged",
    affectedStageIds: [
      "inventory_lot_allocation",
      "production_qc",
      "trace_handover",
      "packing_cartons_dpl",
      "dispatch_consignment",
      "order_complete",
    ],
    blockerDetail:
      "Core Production Migration Release #161 run 34188983863 SUCCESS — semantic parity + production contract smoke on SHA c89c538c (#259 Trace Core authority).",
    failClosedStatus: "implemented",
  },
  {
    id: "oasis-trace-macro-37",
    repository: "oasis-trace",
    pr: "#37",
    state: "open_pr",
    affectedStageIds: ["trace_handover"],
    blockerDetail:
      "Trace #37 device/runtime recertification remains open. Core #259 trace_*_v1 software contracts are consumed; physical scanner/TV handover evidence is fail-closed (Leap 13).",
    failClosedStatus: "physical_uat_only",
  },
  {
    id: "core-order-dispatched-rpc",
    repository: "oasis-supabase-core",
    pr: "canonical release_order_to_dispatched_v1",
    state: "open_pr",
    affectedStageIds: ["dispatch_consignment", "order_complete"],
    blockerDetail:
      "Canonical Core release_order_to_dispatched_v1 is not on Core at SHA c89c538c. Disposable cert bootstrap RPC may exist locally for synthetic rehearsal only — not programme authority.",
    failClosedStatus: "upstream_contract_missing",
    disposableRehearsalBypass: true,
  },
] as const;

export function resolveCoreVerifiedSha(): string | null {
  return process.env.POINT100_CORE_VERIFIED_SHA?.trim() ?? null;
}

export function resolveProductionMigrationRunId(): string | null {
  return process.env.POINT100_PRODUCTION_MIGRATION_RUN_ID?.trim() ?? POINT100_PRODUCTION_MIGRATION_RUN_ID;
}

export function isCoreProductionVerified(): boolean {
  const sha = resolveCoreVerifiedSha();
  return sha === POINT100_CORE_PRODUCTION_VERIFIED_SHA || sha?.startsWith("c89c538c") === true;
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

function isDependencyActiveForStage(
  dep: Point100UpstreamDependency,
  stageId: string,
): boolean {
  if (dep.state === "merged") return false;
  if (!dep.affectedStageIds.includes(stageId)) return false;
  if (dep.disposableRehearsalBypass && isDisposableRehearsalMode()) return false;
  if (dep.id === "core-order-dispatched-rpc" && isDisposableCertBootstrapPermitted()) return false;
  return true;
}

export function upstreamBlockersForStage(stageId: string): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter((dep) => isDependencyActiveForStage(dep, stageId));
}

export function productionGateBlockers(): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter(
    (dep) => dep.state !== "merged" && dep.id === "core-order-dispatched-rpc",
  );
}

export function formatUpstreamBlocker(dep: Point100UpstreamDependency): string {
  return `${dep.repository}${dep.pr}: ${dep.blockerDetail}`;
}
