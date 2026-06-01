import { canReserveStockInGoldenChainWizard } from "@/lib/inventory-authority/inventoryAuthorityMatrix";
import type { ReservationWriteContext } from "@/lib/inventory-reservations/reservationTypes";
import { filterActiveReservationsForStock } from "./goldenChainStockFilters";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";

export const GOLDEN_CHAIN_RESERVATION_DENIED_MESSAGE =
  "Inventory user or supervisor must reserve stock — your role cannot create governed reservations from this wizard.";

export function goldenChainUserCanReserveStock(actorRole: string | null | undefined): boolean {
  return canReserveStockInGoldenChainWizard(actorRole);
}

export function goldenChainReservationWriteContext(
  base: Omit<ReservationWriteContext, "writeChannel">,
): ReservationWriteContext {
  return {
    ...base,
    writeChannel: "golden_chain_operator",
  };
}

export function orderHasActiveReservedStock(reservations: StockReservationRecord[]): boolean {
  return filterActiveReservationsForStock(reservations).some(
    (r) =>
      (r.reservationStatus === "reserved" || r.reservationStatus === "partially_reserved") &&
      r.reservedQty > 0,
  );
}
