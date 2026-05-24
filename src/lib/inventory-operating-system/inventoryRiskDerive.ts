import type { InventoryVarianceSignal } from "./inventoryTypes";

export interface InventoryRiskDeriveInput {
  /** True when shelf / outlet truth is unknown (e.g. only factory snapshot). */
  shelfTruthUnknown: boolean;
  /** Count of reservations not in terminal states (bounded window — caller supplies). */
  openReservationSignals: number;
  /** True when reconciliation backlog is suspected (caller flag). */
  reconciliationBacklogHint: boolean;
}

export function deriveInventoryVarianceEscalations(input: InventoryRiskDeriveInput): InventoryVarianceSignal[] {
  const out: InventoryVarianceSignal[] = [];
  if (input.shelfTruthUnknown) {
    out.push({
      id: "inv-risk:shelf-truth",
      skuOrCartonRef: "—",
      reason: "unexplained_delta",
      severity: "warning",
      detail: "Shelf truth not wired — treat all quantities as factory-row visibility until barcode receiving read model lands.",
    });
  }
  if (input.openReservationSignals > 0) {
    out.push({
      id: "inv-risk:reservation-queue",
      skuOrCartonRef: "—",
      reason: "timing_skew",
      severity: input.openReservationSignals > 5 ? "urgent" : "warning",
      detail: `Reservation / hold signals in current window · ${input.openReservationSignals} (bounded projection — not persisted locks).`,
    });
  }
  if (input.reconciliationBacklogHint) {
    out.push({
      id: "inv-risk:reconciliation",
      skuOrCartonRef: "—",
      reason: "count_mismatch",
      severity: "urgent",
      detail: "Reconciliation backlog hinted by caller — requires inventory controller review before ledger close.",
    });
  }
  return out;
}
