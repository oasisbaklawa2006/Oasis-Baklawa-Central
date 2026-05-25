import type { StockMovementFinalizationType } from "./stockFinalizationTypes";

export function movementTypeForConsumption(intent: "finalize" | "reverse"): StockMovementFinalizationType {
  return intent === "finalize" ? "dispatch_consumption_confirmed" : "dispatch_consumption_reversed";
}

export function buildConsumptionMovementMetadata(params: {
  orderId: string;
  reservationId: string;
  scanReference: string;
  gateReference: string | null;
  dispatchLineageId: string | null;
  physicalDeduction: boolean;
}) {
  return {
    orderId: params.orderId,
    reservationId: params.reservationId,
    scanReference: params.scanReference,
    gateReference: params.gateReference,
    dispatchLineageId: params.dispatchLineageId,
    physicalDeduction: params.physicalDeduction,
    appendOnly: true,
  };
}

/** Ledger rows are insert-only; never update or delete. */
export const LEDGER_IMMUTABLE = true as const;
