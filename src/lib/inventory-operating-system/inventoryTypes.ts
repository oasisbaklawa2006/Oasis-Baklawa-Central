/**
 * Inventory operating system — domain vocabulary only.
 * No persistence, no stock mutation, no hidden writes.
 */

export type InventoryMovementKind =
  | "production_intake"
  | "ready_goods_intake"
  | "assembly_consumption"
  | "dispatch_extraction"
  | "store_transfer"
  | "reservation_hold"
  | "reservation_release"
  | "damage"
  | "expiry"
  | "return"
  | "reconciliation";

export type CartonLifecycleState =
  | "created"
  | "labeled"
  | "scanned_in"
  | "scanned_out"
  | "reserved"
  | "packed"
  | "dispatched"
  | "delivered"
  | "damaged"
  | "destroyed";

export type ReservationLifecycleState =
  | "draft"
  | "verification_required"
  | "pending_approval"
  | "approved"
  | "released"
  | "expired"
  | "cancelled";

/** Immutable ledger row shape (projection / design-time only until persistence ships). */
export interface InventoryMovementProjection {
  id: string;
  kind: InventoryMovementKind;
  /** Display-only quantity text — never inferred from stock tables in this foundation. */
  qtyDisplay: string;
  /** When true, a compensating movement is required before ledger close (design rule). */
  requiresReversalPair: boolean;
  /** Human-readable immutability note for operators. */
  immutabilityNote: string;
}

export interface InventoryVarianceSignal {
  id: string;
  skuOrCartonRef: string;
  reason: "count_mismatch" | "timing_skew" | "unexplained_delta";
  severity: "warning" | "urgent";
  detail: string;
}
