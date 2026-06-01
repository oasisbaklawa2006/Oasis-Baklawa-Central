import type { StockReservationPostFinalizePort } from "./stockFinalizationService";
import type { StockConsumptionLineageRecord, StockFinalizationWriteContext } from "./stockFinalizationTypes";
import type { StockReservationRecord } from "./stockReservationTypes";
import { isReservationFullyFulfilledOnRow } from "@/lib/golden-chain-operator/goldenChainStockFilters";

/**
 * Aligns inventory_reservations rows with existing consumption_finalized lineage (4G drift repair).
 */
export async function syncReservationFulfillmentFromLineage(
  reservations: StockReservationRecord[],
  lineageRows: StockConsumptionLineageRecord[],
  port: StockReservationPostFinalizePort,
  ctx: StockFinalizationWriteContext,
): Promise<string[]> {
  const synced: string[] = [];
  const consumptionRows = lineageRows.filter((r) => r.lineageType === "consumption_finalized");

  for (const row of consumptionRows) {
    const reservation = reservations.find((r) => r.id === row.reservationId);
    if (!reservation || isReservationFullyFulfilledOnRow(reservation)) continue;

    const consumedQty = row.consumedQty > 0 ? row.consumedQty : reservation.reservedQty || reservation.requestedQty;
    if (consumedQty <= 0) continue;

    await port.fulfillAfterStockConsumption(
      {
        reservationId: row.reservationId,
        consumedQty,
        reasonCode: ctx.finalizeReason ?? "stock_consumption_finalized",
      },
      ctx,
    );
    synced.push(row.reservationId);
  }

  return synced;
}
