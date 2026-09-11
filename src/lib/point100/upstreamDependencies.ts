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

/** Production-certified Core boundary — current protected production release after Macro Dispatch Finalize #260. */
export const POINT100_CORE_PRODUCTION_VERIFIED_SHA = "1503d6c5f0dcc04890190e00587fcdbf9abb5b20";

export const POINT100_PRODUCTION_MIGRATION_GATE = "oasis-supabase-core#180";

/** GitHub Actions run certifying exact-SHA deploy, semantic parity and production contract smoke for the current protected release. */
export const POINT100_PRODUCTION_MIGRATION_RUN_ID = "34653753066";

/** Governed Trace software contracts shipped on Core #259 and consumed by merged Trace #37. */
export const POINT100_TRACE_SOFTWARE_RPCS = [
  "trace_verify_handover_evidence_v1",
  "trace_sign_handover_evidence_v1",
  "trace_allocate_identity_v1",
] as const;

/** Canonical Core dispatch-finalize authority delivered by #260. */
export const POINT100_DISPATCH_FINALIZE_RPC = "release_order_to_dispatched_v1";

/** Retained as provenance for capability-matrix compatibility; #260 is merged and production-certified. */
export const POINT100_CORE_PENDING_DISPATCH_PR = "#260";

/**
 * Optional explicit recertification run override. The canonical default is the current protected production release.
 */
export const POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID_ENV = "POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID";

/** No Core RPC remains pending on the certified production pin. */
const POINT100_PENDING_CORE_RPCS = new Set<string>();

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
      "Central Order→Factory→Packing→Dispatch→Gate journey merged to main (#556). Point100 binds canonical dispatch workflow routes and clients.",
    failClosedStatus: "implemented",
  },
  {
    id: "central-macro-management-558",
    repository: "Oasis-Baklawa-Central",
    pr: "#558",
    state: "merged",
    affectedStageIds: ["finance_verification_reconciliation", "final_invoice_balance", "finance_dispatch_clearance"],
    blockerDetail:
      "Management / Tally / compliance macro #558 merged to Central main at a619a7a2; Point100 consumes the canonical read/reporting surface without shadow authority.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-inventory-macro-256",
    repository: "oasis-supabase-core",
    pr: "#256",
    state: "merged",
    affectedStageIds: ["inventory_lot_allocation", "production_qc"],
    blockerDetail:
      "Macro Inventory #256 merged and remains an ancestor of the production-certified current pin. Lot/putaway/exception/factory RPCs are consumed from Core SHA 1503d6c5.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-production-migration-159",
    repository: "oasis-supabase-core",
    pr: "#159",
    state: "merged",
    affectedStageIds: ["inventory_lot_allocation", "production_qc"],
    blockerDetail:
      "Core Production Migration Release #159 deployed Macro Inventory #256 and is superseded as the current production pin by protected run 34653753066 / SHA 1503d6c5.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-macro-trace-259",
    repository: "oasis-supabase-core",
    pr: "#259",
    state: "merged",
    affectedStageIds: ["trace_handover"],
    blockerDetail:
      "Macro Trace Core #259 server identity + authenticated handover authority is an ancestor of production-certified Core SHA 1503d6c5.",
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
      "Core Production Migration Release #161 certified Trace Core #259 and is superseded by the current protected production boundary.",
    failClosedStatus: "implemented",
  },
  {
    id: "oasis-trace-macro-37",
    repository: "oasis-trace",
    pr: "#37",
    state: "merged",
    affectedStageIds: ["trace_handover"],
    blockerDetail:
      "Trace #37 software recertification merged at 894f27327381ce168d168530eba3c3722d71eaee. Physical scanner/printer/TV handover evidence remains a separate Leap 13 UAT gate and is not claimed here.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-macro-dispatch-260",
    repository: "oasis-supabase-core",
    pr: POINT100_CORE_PENDING_DISPATCH_PR,
    state: "merged",
    affectedStageIds: ["dispatch_consignment", "order_complete"],
    blockerDetail:
      "Core #260 canonical release_order_to_dispatched_v1 remains on the production-certified lineage; the current protected production authority is run 34653753066 on Core SHA 1503d6c5f0dcc04890190e00587fcdbf9abb5b20.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-production-migration-163",
    repository: "oasis-supabase-core",
    pr: "#163",
    state: "merged",
    affectedStageIds: [
      "finance_dispatch_clearance",
      "dispatch_consignment",
      "security_gate",
      "customer_dispatch_proof",
      "order_complete",
    ],
    blockerDetail:
      "Core Production Migration Release #163 is superseded by protected run 34653753066 / SHA 1503d6c5 on release #180.",
    failClosedStatus: "implemented",
  },
  {
    id: "core-production-migration-180",
    repository: "oasis-supabase-core",
    pr: "#180",
    state: "merged",
    affectedStageIds: [
      "finance_dispatch_clearance",
      "dispatch_consignment",
      "security_gate",
      "customer_dispatch_proof",
      "order_complete",
    ],
    blockerDetail:
      "Current protected Production Migration Release run 34653753066 passed on exact Core SHA 1503d6c5f0dcc04890190e00587fcdbf9abb5b20; Point100 binds to that exact current production authority.",
    failClosedStatus: "implemented",
  },
] as const;

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

function isDependencyActiveForStage(
  dep: Point100UpstreamDependency,
  stageId: string,
): boolean {
  if (dep.state === "merged") return false;
  if (!dep.affectedStageIds.includes(stageId)) return false;
  if (dep.disposableRehearsalBypass && isDisposableRehearsalMode()) return false;
  return true;
}

export function upstreamBlockersForStage(stageId: string): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter((dep) => isDependencyActiveForStage(dep, stageId));
}

export function productionGateBlockers(): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter(
    (dep) => dep.state !== "merged" && dep.id === "core-macro-dispatch-260",
  );
}

export function formatUpstreamBlocker(dep: Point100UpstreamDependency): string {
  return `${dep.repository}${dep.pr}: ${dep.blockerDetail}`;
}
