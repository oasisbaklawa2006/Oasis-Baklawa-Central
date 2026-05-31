import type { StockFinalizationInput } from "@/lib/stock-finalization/stockFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import type { DispatchReleaseStatus } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import { reconcileReservationsForConsumption } from "@/lib/stock-finalization/stockReservationReconciliation";
import { filterActiveReservationsForStock } from "@/lib/golden-chain-operator/goldenChainStockFilters";
import { deriveSignalMeta } from "../signalStale";
import type { DerivedSignalMeta } from "../types";

export interface StockBalanceSlice {
  productId: string;
  sku: string;
  locationCode: string;
  availableQty: number;
  reservedQty: number;
  version: number;
}

export interface StockLineageSlice {
  reservationId: string;
  lineageType: string;
  createdAt: string;
}

export interface StockSignalFusion {
  input: StockFinalizationInput;
  signalMeta: DerivedSignalMeta;
  missingSignals: string[];
  reconciliationVariance: boolean;
  balanceMissing: boolean;
}

export function deriveStockInputFromSlices(params: {
  orderId: string;
  orderStatus: string;
  dispatchReleaseStatus: DispatchReleaseStatus;
  reservations: StockReservationRecord[];
  scanReference: string | null;
  gateReference: string | null;
  dispatchLineageId: string | null;
  locationCode: string;
  balances: StockBalanceSlice[];
  lineage: StockLineageSlice[];
}): StockSignalFusion {
  const missingSignals: string[] = [];
  const latestAt = params.lineage[0]?.createdAt ?? null;
  const signalMeta = deriveSignalMeta(latestAt);

  const finalizedIds = params.lineage
    .filter((l) => l.lineageType === "consumption_finalized")
    .map((l) => l.reservationId);

  const activeReservations = filterActiveReservationsForStock(params.reservations);
  const reconciliation = reconcileReservationsForConsumption(activeReservations, finalizedIds);
  const reconciliationVariance = reconciliation.reconciliationStatus === "variance";

  let balanceMissing = false;
  for (const r of activeReservations) {
    const bal = params.balances.find((b) => b.sku === r.sku && b.locationCode === params.locationCode);
    if (!bal) {
      balanceMissing = true;
      missingSignals.push(`balance_not_found:${r.sku}`);
    }
  }

  if (params.orderStatus !== "dispatched") {
    missingSignals.push("order_status_not_dispatched");
  }
  if (params.dispatchReleaseStatus !== "dispatch_finalized") {
    missingSignals.push("dispatch_not_finalized");
  }
  if (reconciliationVariance) {
    missingSignals.push("reservation_variance");
  }
  if (!params.scanReference?.trim()) {
    missingSignals.push("scan_reference_missing");
  }
  if (!params.gateReference?.trim()) {
    missingSignals.push("gate_reference_missing");
  }

  const input: StockFinalizationInput = {
    orderId: params.orderId,
    orderStatus: params.orderStatus,
    dispatchReleaseStatus: params.dispatchReleaseStatus,
    reservations: activeReservations,
    scanReference: params.scanReference,
    gateReference: params.gateReference,
    dispatchLineageId: params.dispatchLineageId,
    locationCode: params.locationCode,
    alreadyFinalizedReservationIds: finalizedIds,
  };

  return {
    input,
    signalMeta,
    missingSignals,
    reconciliationVariance,
    balanceMissing,
  };
}

/** dispatch_finalized + dispatched required before stock finalization candidate */
export function isStockFinalizationCandidate(orderStatus: string, dispatchStatus: DispatchReleaseStatus): boolean {
  return dispatchStatus === "dispatch_finalized" && orderStatus === "dispatched";
}
