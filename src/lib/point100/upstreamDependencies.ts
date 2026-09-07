/**
 * Point100 upstream macro dependencies — fail-closed registry for open PRs that
 * must not be shadowed by Central disposable bootstrap or preview fallbacks.
 */

import type { Point100CapabilityStatus } from "./capabilityStatus";

export type UpstreamDependencyState = "open_pr" | "merged" | "physical_uat_only";

export type Point100UpstreamDependency = {
  id: string;
  repository: string;
  pr: string;
  state: UpstreamDependencyState;
  affectedStageIds: readonly string[];
  blockerDetail: string;
  failClosedStatus: Point100CapabilityStatus;
};

/** Rebind state here when Mission Control clears an upstream macro PR. */
export const POINT100_UPSTREAM_DEPENDENCIES: readonly Point100UpstreamDependency[] = [
  {
    id: "core-inventory-macro-256",
    repository: "oasis-supabase-core",
    pr: "#256",
    state: "open_pr",
    affectedStageIds: ["inventory_lot_allocation"],
    blockerDetail:
      "Macro Inventory #256 governed lot/quarantine allocation authority is not merged to Core main. Harness exercises only merged reserve/putaway RPCs; no shadow lot truth.",
    failClosedStatus: "upstream_contract_missing",
  },
  {
    id: "oasis-trace-macro-37",
    repository: "oasis-trace",
    pr: "#37",
    state: "open_pr",
    affectedStageIds: ["trace_handover"],
    blockerDetail:
      "Trace #37 scan handover / DPL carton membership contracts are not merged. Central scan-timeline projection is software-only; physical scanner evidence remains Leap 13.",
    failClosedStatus: "physical_uat_only",
  },
  {
    id: "core-order-dispatched-rpc",
    repository: "oasis-supabase-core",
    pr: "canonical release_order_to_dispatched_v1",
    state: "open_pr",
    affectedStageIds: ["dispatch_consignment", "order_complete"],
    blockerDetail:
      "Canonical Core release_order_to_dispatched_v1 is not merged. Disposable cert bootstrap RPC may exist locally but is not programme authority.",
    failClosedStatus: "upstream_contract_missing",
  },
] as const;

export function upstreamBlockersForStage(stageId: string): Point100UpstreamDependency[] {
  return POINT100_UPSTREAM_DEPENDENCIES.filter(
    (dep) => dep.state !== "merged" && dep.affectedStageIds.includes(stageId),
  );
}

export function isDisposableCertBootstrapPermitted(): boolean {
  return process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP === "true";
}

export function formatUpstreamBlocker(dep: Point100UpstreamDependency): string {
  return `${dep.repository}${dep.pr}: ${dep.blockerDetail}`;
}
