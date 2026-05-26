/**
 * Phase 4F — Blocks legacy direct orders.status → dispatched mutations outside governed finalization.
 */

export const DISPATCH_FINALIZATION_ROUTE = "/admin/dispatch-finalization";

export const LEGACY_DISPATCH_MUTATION_MESSAGE =
  "Order dispatch closure is governed only via Dispatch Finalization (Phase 4E). Legacy direct status updates are disabled.";

export interface LegacyDispatchBlockResult {
  blocked: true;
  message: string;
  route: string;
}

/** Returns block metadata when a legacy UI path attempts a direct dispatched mutation. */
export function blockLegacyDispatchStatusMutation(
  source: string,
): LegacyDispatchBlockResult {
  return {
    blocked: true,
    message: `${LEGACY_DISPATCH_MUTATION_MESSAGE} (source: ${source})`,
    route: DISPATCH_FINALIZATION_ROUTE,
  };
}

export function isDispatchedStatusMutation(targetStatus: string): boolean {
  return targetStatus.trim().toLowerCase() === "dispatched";
}
