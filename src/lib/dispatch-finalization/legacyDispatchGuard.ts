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

/** True when a proposed status transition targets the governed `dispatched` state. */
export function isDispatchedStatusMutation(targetStatus: string): boolean {
  return targetStatus.trim().toLowerCase() === "dispatched";
}

/**
 * FACT-C3 correction — blocks legacy B2B carton/packing-list/packed-quantity
 * mutations outside the governed DispatchManagement consignment/carton/DPL
 * chain. Distinct from blockLegacyDispatchStatusMutation above: that guards
 * the later orders.status -> dispatched closure (Phase 4E); this guards the
 * earlier carton, packing list and packed-quantity capture that FACT-C3
 * made the single governed B2B authority for.
 */
export const B2B_DISPATCH_MANAGEMENT_ROUTE = "/admin/dispatch-mgmt";

export const LEGACY_B2B_CARTON_DPL_MUTATION_MESSAGE =
  "B2B carton, packing list and packed-quantity capture is governed only via Dispatch Management (FACT-C3). Legacy direct writes are disabled.";

/**
 * Returns block metadata when a legacy screen attempts to mutate B2B carton,
 * packing-list, or packed-quantity state directly, bypassing the governed
 * DispatchManagement RPC chain. Callers must invoke this as the first
 * statement of the mutation handler, before any other validation, so the
 * legacy path never reaches its old writes.
 */
export function blockLegacyB2bCartonDplMutation(
  source: string,
): LegacyDispatchBlockResult {
  return {
    blocked: true,
    message: `${LEGACY_B2B_CARTON_DPL_MUTATION_MESSAGE} (source: ${source})`,
    route: B2B_DISPATCH_MANAGEMENT_ROUTE,
  };
}
