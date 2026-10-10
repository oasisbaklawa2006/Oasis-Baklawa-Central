/** Point 76 — canonical partial / split fulfilment facts (read-only projection inputs). */

export type RemainderDisposition =
  | "open"
  | "pending_customer"
  | "approved_closed"
  | "cancelled"
  | "unknown";

export type PartialFulfilmentAuthorityState =
  | "dispatch_line_facts_available"
  | "dispatch_authority_absent"
  | "production_split_authority_absent";

export interface ConsignmentSplitFact {
  consignmentId: string;
  consignmentNumber: string;
  sequenceNumber: number;
  status: string;
  fragmentationOrigin: string | null;
  fragmentationReason: string | null;
  lineSelectedQty: number;
}

export interface ResidualClosureFact {
  closureId: string;
  orderItemId: string;
  approvedClosedQty: number;
  reason: string;
  correlationId: string;
}

export interface ReservationLineFact {
  reservationId: string;
  requestedQty: number;
  reservedQty: number;
  fulfilledQty: number;
  releasedQty: number;
  reservationStatus: string;
}

export interface DispatchLineFact {
  orderItemId: string;
  productId: string | null;
  originalOrderQty: number;
  cumulativeDispatchedQty: number;
  residualQty: number;
  approvedClosedQty: number;
}

export interface PartialFulfilmentLineInput {
  orderItemId: string;
  productId: string | null;
  orderedQty: number;
  packedQty: number;
  productionStatus: string | null;
  dispatchLine?: DispatchLineFact | null;
  reservations: ReservationLineFact[];
  residualClosures: ResidualClosureFact[];
  consignmentSplits: ConsignmentSplitFact[];
  cancelledQty?: number;
}

export interface PartialFulfilmentLineProjection {
  orderItemId: string;
  productId: string | null;
  orderedQty: number;
  confirmedQty: number;
  cancelledQty: number;
  fulfilledQty: number;
  packedQty: number;
  dispatchedQty: number;
  deliveredQty: number;
  approvedClosedQty: number;
  remainderQty: number;
  remainderDisposition: RemainderDisposition;
  openConsignmentCount: number;
  quantityConserved: boolean;
  conservationViolations: string[];
}

export interface PartialFulfilmentOrderProjection {
  orderId: string;
  authorityState: PartialFulfilmentAuthorityState;
  lines: PartialFulfilmentLineProjection[];
  hasPartialFulfilment: boolean;
  hasOpenRemainder: boolean;
  hasSplitConsignments: boolean;
  quantityConserved: boolean;
  conservationViolations: string[];
  replayKey: string;
  evaluatedAt: string;
}

export interface PartialFulfilmentActionBlocker {
  code: string;
  message: string;
  scope: "production_split" | "dispatch_split" | "remainder_closure";
}

export interface PartialFulfilmentActionResult {
  ok: boolean;
  alreadyApplied?: boolean;
  blockers?: PartialFulfilmentActionBlocker[];
  correlationId?: string;
}

/** Core RPC names Central may call — absent RPCs fail closed. */
export const POINT76_CORE_RPC = {
  productionPartialFulfilment: "record_order_partial_fulfilment_v1",
  dispatchSplitConsignment: "create_b2b_dispatch_consignment",
  remainderClosure: "approve_b2b_dispatch_residual_closure_v1",
} as const;

export const POINT76_CORE_PREREQUISITE =
  "oasis-supabase-core must expose governed partial/split fulfilment RPCs before Central can mutate remainder or production splits.";
