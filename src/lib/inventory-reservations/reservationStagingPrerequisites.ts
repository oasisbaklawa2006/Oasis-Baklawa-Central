import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseScanRepository } from "@/lib/barcode-execution/supabaseScanRepository";
import { createSupabaseStockBalanceRepository } from "@/lib/stock-finalization/supabaseStockFinalizationStore";
import type { ReservationWriteContext } from "./reservationTypes";

export interface StagingScanInput {
  orderId: string;
  barcodeValue: string;
  scanType?: "carton" | "dispatch_gate";
}

/** Governed append-only scan for 4G scanReference — explicit staging / ops action. */
export async function recordVerifiedScanForStockFinalization(
  client: SupabaseClient,
  input: StagingScanInput,
  ctx: Pick<ReservationWriteContext, "correlationId" | "actorUserId" | "actorRole">,
) {
  const scanRepo = createSupabaseScanRepository(client);
  const barcode = input.barcodeValue.trim();
  if (!barcode) throw new Error("Barcode value is required");
  const scanType = input.scanType ?? "carton";
  return scanRepo.insertScan({
    scan_type: scanType,
    verification_type: scanType === "dispatch_gate" ? "gate_check" : "identity_match",
    entity_type: "order",
    entity_id: input.orderId,
    order_id: input.orderId,
    barcode_value: barcode,
    verification_status: "verified",
    scan_source: "reservation_board_staging",
    actor_id: ctx.actorUserId,
    actor_role: ctx.actorRole,
    metadata: { source: "reservation_board_14f", governedOnly: true },
    correlation_id: ctx.correlationId,
    idempotency_key: `scan-14f-${input.orderId}-${scanType}-${barcode}`,
  });
}

export interface StagingBalanceInput {
  productId: string;
  sku: string;
  locationCode: string;
  availableQty: number;
}

/**
 * Initial balance row for a SKU/location — does not deduct stock.
 * Used when staging has no inventory_stock_balances row yet.
 */
export async function seedInitialStockBalance(
  client: SupabaseClient,
  input: StagingBalanceInput,
) {
  const balances = createSupabaseStockBalanceRepository(client);
  const existing = await balances.getBalance(input.productId, input.sku, input.locationCode);
  if (existing) {
    return { created: false as const, balance: existing };
  }
  const row = await balances.upsertBalanceInitial({
    productId: input.productId,
    sku: input.sku,
    locationCode: input.locationCode,
    availableQty: input.availableQty,
    reservedQty: 0,
    damagedQty: 0,
    expiredQty: 0,
    quarantineQty: 0,
    version: 1,
  });
  return { created: true as const, balance: row };
}
