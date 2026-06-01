/**
 * Phase 4G — Governed physical stock finalization after dispatch_finalized.
 */

import type { InventoryReservationWriteChannel } from "@/lib/inventory-authority/inventoryAuthorityTypes";
import type { StockReservationRecord } from "./stockReservationTypes";
import type { DispatchReleaseStatus } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";

export const STOCK_FINALIZATION_STATUSES = [
  "pending_dispatch_finalization",
  "ready_for_consumption",
  "consumption_blocked",
  "consumption_finalized",
  "consumption_reversed",
  "variance_detected",
] as const;

export type StockFinalizationStatus = (typeof STOCK_FINALIZATION_STATUSES)[number];

export const STOCK_MOVEMENT_FINALIZATION_TYPES = [
  "dispatch_consumption_confirmed",
  "dispatch_consumption_reversed",
  "stock_variance_recorded",
  "stock_quarantined",
  "stock_quarantine_released",
] as const;

export type StockMovementFinalizationType = (typeof STOCK_MOVEMENT_FINALIZATION_TYPES)[number];

export const STOCK_FINALIZATION_OPERATIONAL_EVENT_TYPES = [
  "stock_consumption_finalized",
  "stock_consumption_reversed",
  "stock_variance_detected",
  "stock_variance_recorded",
  "stock_quarantined",
  "stock_quarantine_released",
] as const;

export type StockFinalizationOperationalEventType =
  (typeof STOCK_FINALIZATION_OPERATIONAL_EVENT_TYPES)[number];

export interface StockBalanceRecord {
  id: string;
  productId: string;
  sku: string;
  locationCode: string;
  availableQty: number;
  reservedQty: number;
  damagedQty: number;
  expiredQty: number;
  quarantineQty: number;
  version: number;
  updatedAt: string;
}

export interface StockConsumptionLineageRecord {
  id: string;
  orderId: string;
  reservationId: string | null;
  productId: string;
  sku: string;
  locationCode: string;
  consumedQty: number;
  movementId: string | null;
  lineageType:
    | "consumption_finalized"
    | "consumption_reversed"
    | "variance_recorded"
    | "quarantine_applied"
    | "quarantine_released";
  scanReference: string | null;
  gateReference: string | null;
  dispatchLineageId: string | null;
  actorId: string | null;
  actorRole: string | null;
  reasonCode: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StockFinalizationInput {
  orderId: string;
  orderStatus: string;
  dispatchReleaseStatus: DispatchReleaseStatus;
  reservations: StockReservationRecord[];
  scanReference: string | null;
  gateReference: string | null;
  dispatchLineageId: string | null;
  locationCode: string;
  alreadyFinalizedReservationIds?: string[];
}

export interface StockFinalizationProjection {
  orderId: string;
  finalizationStatus: StockFinalizationStatus;
  reconciliationStatus: "aligned" | "partial" | "blocked" | "variance";
  consumedQty: number;
  varianceQty: number;
  unresolvedReservationQty: number;
  blockingReasons: string[];
  warnings: string[];
  canFinalizeConsumption: boolean;
  evaluatedAt: string;
}

export interface StockFinalizationWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  finalizeReason?: string | null;
  reversalReason?: string | null;
  overrideReason?: string | null;
  varianceReason?: string | null;
  /** Passed through to reservation fulfill after consumption (Golden Chain wizard). */
  reservationWriteChannel?: InventoryReservationWriteChannel;
}

export interface FinalizeConsumptionLineItem {
  reservationId: string;
  productId: string;
  sku: string;
  locationCode: string;
  consumeQty: number;
  expectedBalanceVersion: number;
}

export interface FinalizeConsumptionParams {
  orderId: string;
  items: FinalizeConsumptionLineItem[];
  scanReference: string;
  gateReference: string | null;
  dispatchLineageId: string | null;
}

export interface StockFinalizationOperationalEventRecord {
  id: string;
  eventType: StockFinalizationOperationalEventType;
  orderId: string;
  title: string;
  message: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  visibility: "internal";
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface StockBalanceRepository {
  getBalance(productId: string, sku: string, locationCode: string): Promise<StockBalanceRecord | null>;
  upsertBalanceInitial(row: Omit<StockBalanceRecord, "id" | "updatedAt">): Promise<StockBalanceRecord>;
  applyConsumptionWithLock(params: {
    productId: string;
    sku: string;
    locationCode: string;
    consumeQty: number;
    releaseReservedQty: number;
    expectedVersion: number;
  }): Promise<{ updated: boolean; balance: StockBalanceRecord | null }>;
  applyReversalWithLock(params: {
    productId: string;
    sku: string;
    locationCode: string;
    restoreQty: number;
    /** Reserved qty released during finalize; restored on reversal. Defaults to restoreQty. */
    restoreReservedQty?: number;
    expectedVersion: number;
  }): Promise<{ updated: boolean; balance: StockBalanceRecord | null }>;
}

export interface StockMovementRepository {
  appendMovement(row: {
    movementType: StockMovementFinalizationType;
    reservationId: string | null;
    productId: string;
    sku: string;
    quantity: number;
    sourceLocation: string | null;
    destinationLocation: string | null;
    actorId: string | null;
    reasonCode: string | null;
    correlationId: string;
    metadata: Record<string, unknown>;
  }): Promise<{ id: string }>;
  listByOrder(orderId: string): Promise<
    {
      id: string;
      movementType: string;
      quantity: number;
      sku: string;
      correlationId: string;
      createdAt: string;
      metadata: Record<string, unknown>;
    }[]
  >;
}

export interface StockLineageRepository {
  insertLineage(row: Omit<StockConsumptionLineageRecord, "id" | "createdAt">): Promise<StockConsumptionLineageRecord>;
  listByOrder(orderId: string): Promise<StockConsumptionLineageRecord[]>;
}

export class StockFinalizationError extends Error {
  constructor(
    public readonly code:
      | "authority_denied"
      | "forbidden_action"
      | "validation_failed"
      | "not_eligible"
      | "reason_required"
      | "stale_version"
      | "negative_stock"
      | "balance_not_found"
      | "already_finalized"
      | "reconciliation_blocked",
    message: string,
  ) {
    super(message);
    this.name = "StockFinalizationError";
  }
}

export const FORBIDDEN_STOCK_UI_PATTERNS = [
  "silentDeduct",
  "autoAdjust",
  "deleteLedger",
  "capturePayment",
  "generateInvoice",
  "sendNotification",
  "forceBalance",
] as const;
