import {
  DISPATCH_FINALIZE_TARGET_STATUS,
  GOVERNED_DISPATCH_SOURCE_STATUSES,
  DispatchFinalizationError,
} from "./dispatchFinalizationTypes";
import type {
  OrderDispatchStatusRepository,
  OrderDispatchStatusUpdateParams,
  OrderDispatchStatusUpdateResult,
} from "./dispatchFinalizationTypes";

export function isGovernedDispatchSourceStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return (GOVERNED_DISPATCH_SOURCE_STATUSES as readonly string[]).includes(normalized);
}

export function assertGovernedDispatchTransition(previousStatus: string, nextStatus: string): void {
  const prev = previousStatus.trim().toLowerCase();
  const next = nextStatus.trim().toLowerCase();

  if (next !== DISPATCH_FINALIZE_TARGET_STATUS) {
    throw new DispatchFinalizationError(
      "validation_failed",
      `Governed path only allows transition to ${DISPATCH_FINALIZE_TARGET_STATUS}`,
    );
  }

  if (prev === DISPATCH_FINALIZE_TARGET_STATUS) {
    throw new DispatchFinalizationError("already_finalized", "Order is already dispatched");
  }

  if (!isGovernedDispatchSourceStatus(prev)) {
    throw new DispatchFinalizationError(
      "validation_failed",
      `Cannot finalize from status ${previousStatus}`,
    );
  }
}

/**
 * Sole governed path for orders.status → dispatched. Uses optimistic status guard.
 */
export async function updateOrderDispatchStatus(
  repo: OrderDispatchStatusRepository,
  params: OrderDispatchStatusUpdateParams,
): Promise<OrderDispatchStatusUpdateResult> {
  assertGovernedDispatchTransition(params.expectedPreviousStatus, params.nextStatus);
  const result = await repo.updateOrderDispatchStatus(params);
  if (!result.updated) {
    throw new DispatchFinalizationError(
      "stale_status",
      `Order status changed from expected ${params.expectedPreviousStatus}`,
    );
  }
  return result;
}
