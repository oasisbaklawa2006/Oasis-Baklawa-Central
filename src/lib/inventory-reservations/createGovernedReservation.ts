import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAvailabilitySnapshotFromBalance } from "./buildAvailabilitySnapshot";
import { sumOpenReservedQtyForSku } from "./reservationBoardQueries";
import { createSupabaseReservationService } from "./supabaseReservationRepository";
import type { ReservationWriteContext } from "./reservationTypes";
import { ReservationError } from "./reservationTypes";

export interface CreateAndReserveInput {
  orderId: string;
  productId: string;
  sku: string;
  quantity: number;
  locationCode: string;
  sourceDepartment?: string | null;
  notes?: string | null;
}

export interface CreateAndReserveResult {
  reservationId: string;
  reservationNumber: string;
  reservationStatus: string;
  reservedQty: number;
  movementIds: string[];
}

/**
 * Two-step governed path: createReservation → reserveInventory.
 * Writes inventory_reservations + inventory_movements via repository only.
 */
export async function createAndReserveInventoryForOrder(
  client: SupabaseClient,
  input: CreateAndReserveInput,
  ctx: ReservationWriteContext,
): Promise<CreateAndReserveResult> {
  const qty = Math.max(0.001, input.quantity);
  const service = await createSupabaseReservationService(client).getService();

  const created = await service.createReservation(
    {
      orderId: input.orderId,
      productId: input.productId,
      sku: input.sku,
      requestedQty: qty,
      sourceDepartment: input.sourceDepartment ?? "reservation_board",
      notes: input.notes ?? null,
    },
    ctx,
  );

  const movementIds = [created.movementId];

  const { data: balanceRow, error: balErr } = await client
    .from("inventory_stock_balances")
    .select("available_qty, reserved_qty")
    .eq("product_id", input.productId)
    .eq("sku", input.sku)
    .eq("location_code", input.locationCode)
    .maybeSingle();
  if (balErr) throw new Error(balErr.message);

  const openReservedQty = await sumOpenReservedQtyForSku(client, input.productId, input.sku, input.orderId);
  const snapshot = buildAvailabilitySnapshotFromBalance({
    productId: input.productId,
    sku: input.sku,
    balance: balanceRow
      ? {
          availableQty: Number(balanceRow.available_qty),
          reservedQty: Number(balanceRow.reserved_qty),
        }
      : null,
    openReservedQty,
  });

  try {
    const reserved = await service.reserveInventory(
      {
        reservationId: created.reservation.id,
        expectedVersion: created.reservation.version,
        reserveQty: qty,
        reason: `Governed reserve from reservation board (${input.locationCode})`,
      },
      ctx,
      snapshot,
    );
    movementIds.push(reserved.movementId);
    return {
      reservationId: reserved.reservation.id,
      reservationNumber: reserved.reservation.reservationNumber,
      reservationStatus: reserved.reservation.reservationStatus,
      reservedQty: reserved.reservation.reservedQty,
      movementIds,
    };
  } catch (e) {
    if (e instanceof ReservationError) throw e;
    throw e;
  }
}
