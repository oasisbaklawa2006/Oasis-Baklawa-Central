import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAvailabilitySnapshotFromBalance } from "./buildAvailabilitySnapshot";
import { sumOpenReservedQtyForSku } from "./reservationBoardQueries";
import { createSupabaseReservationService } from "./supabaseReservationRepository";
import type { ReservationWriteContext } from "./reservationTypes";
import type { InventoryReservationRecord } from "./reservationTypes";
import { isReservationOpen } from "./reservationLifecycle";
import { ReservationError } from "./reservationTypes";
import type { ReservationService } from "./reservationService";

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

type CreatedReservationRef = Pick<InventoryReservationRecord, "id" | "version">;

/**
 * Best-effort cancel when create succeeded but a later step failed before reserve completed.
 * Uses latest row when readable; falls back to the create response id/version.
 */
export async function compensateOpenReservationAfterFailure(
  service: ReservationService,
  created: CreatedReservationRef,
  ctx: ReservationWriteContext,
  failureMessage: string,
): Promise<void> {
  let cancelTarget: CreatedReservationRef & { reservationStatus?: InventoryReservationRecord["reservationStatus"] } =
    {
      id: created.id,
      version: created.version,
      reservationStatus: "pending",
    };

  try {
    const latest = await service.getReservation(created.id);
    if (latest) {
      cancelTarget = latest;
    }
  } catch {
    /* Use create response — getReservation failure must not block compensation. */
  }

  if (cancelTarget.reservationStatus && !isReservationOpen(cancelTarget.reservationStatus)) {
    return;
  }

  try {
    await service.cancelReservation(
      {
        reservationId: cancelTarget.id,
        expectedVersion: cancelTarget.version,
        reason: `Automatic cancel after failure: ${failureMessage}`,
      },
      ctx,
    );
  } catch {
    /* Best-effort — primary error remains authoritative. */
  }
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

  const failAndCompensate = async (primaryError: unknown): Promise<never> => {
    const message = primaryError instanceof Error ? primaryError.message : String(primaryError);
    await compensateOpenReservationAfterFailure(service, created.reservation, ctx, message);
    throw primaryError;
  };

  let snapshot;
  try {
    const { data: balanceRow, error: balErr } = await client
      .from("inventory_stock_balances")
      .select("available_qty, reserved_qty")
      .eq("product_id", input.productId)
      .eq("sku", input.sku)
      .eq("location_code", input.locationCode)
      .maybeSingle();
    if (balErr) throw new Error(balErr.message);

    const openReservedQty = await sumOpenReservedQtyForSku(client, input.productId, input.sku, input.orderId);
    snapshot = buildAvailabilitySnapshotFromBalance({
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
  } catch (lookupError) {
    return failAndCompensate(lookupError);
  }

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
  } catch (reserveError) {
    return failAndCompensate(reserveError);
  }
}
