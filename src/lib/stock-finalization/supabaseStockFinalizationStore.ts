import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StockBalanceRecord,
  StockBalanceRepository,
  StockConsumptionLineageRecord,
  StockLineageRepository,
  StockMovementRepository,
} from "./stockFinalizationTypes";

interface BalanceRow {
  id: string;
  product_id: string;
  sku: string;
  location_code: string;
  available_qty: number;
  reserved_qty: number;
  damaged_qty: number;
  expired_qty: number;
  quarantine_qty: number;
  version: number;
  updated_at: string;
}

function mapBalance(row: BalanceRow): StockBalanceRecord {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    locationCode: row.location_code,
    availableQty: Number(row.available_qty),
    reservedQty: Number(row.reserved_qty),
    damagedQty: Number(row.damaged_qty),
    expiredQty: Number(row.expired_qty),
    quarantineQty: Number(row.quarantine_qty),
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseStockBalanceRepository(client: SupabaseClient): StockBalanceRepository {
  return {
    async getBalance(productId, sku, locationCode) {
      const { data, error } = await client
        .from("inventory_stock_balances")
        .select("*")
        .eq("product_id", productId)
        .eq("sku", sku)
        .eq("location_code", locationCode)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapBalance(data as BalanceRow) : null;
    },

    async upsertBalanceInitial(row) {
      const { data, error } = await client
        .from("inventory_stock_balances")
        .insert({
          product_id: row.productId,
          sku: row.sku,
          location_code: row.locationCode,
          available_qty: row.availableQty,
          reserved_qty: row.reservedQty,
          damaged_qty: row.damagedQty,
          expired_qty: row.expiredQty,
          quarantine_qty: row.quarantineQty,
          version: row.version,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapBalance(data as BalanceRow);
    },

    async applyConsumptionWithLock(params) {
      const current = await this.getBalance(params.productId, params.sku, params.locationCode);
      if (!current || current.version !== params.expectedVersion) {
        return { updated: false, balance: current };
      }
      const nextAvailable = current.availableQty - params.consumeQty;
      const nextReserved = current.reservedQty - params.releaseReservedQty;
      if (nextAvailable < 0 || nextReserved < 0) {
        return { updated: false, balance: current };
      }
      const { data, error } = await client
        .from("inventory_stock_balances")
        .update({
          available_qty: nextAvailable,
          reserved_qty: nextReserved,
          version: current.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .eq("version", params.expectedVersion)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { updated: false, balance: current };
      return { updated: true, balance: mapBalance(data as BalanceRow) };
    },

    async applyReversalWithLock(params) {
      const current = await this.getBalance(params.productId, params.sku, params.locationCode);
      if (!current || current.version !== params.expectedVersion) {
        return { updated: false, balance: current };
      }
      const { data, error } = await client
        .from("inventory_stock_balances")
        .update({
          available_qty: current.availableQty + params.restoreQty,
          version: current.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .eq("version", params.expectedVersion)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { updated: false, balance: current };
      return { updated: true, balance: mapBalance(data as BalanceRow) };
    },
  };
}

export function createSupabaseStockMovementRepository(client: SupabaseClient): StockMovementRepository {
  return {
    async appendMovement(row) {
      const { data, error } = await client
        .from("inventory_movements")
        .insert({
          movement_type: row.movementType,
          reservation_id: row.reservationId,
          product_id: row.productId,
          sku: row.sku,
          quantity: row.quantity,
          source_location: row.sourceLocation,
          destination_location: row.destinationLocation,
          actor_id: row.actorId,
          reason_code: row.reasonCode,
          correlation_id: row.correlationId,
          metadata: row.metadata,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: (data as { id: string }).id };
    },
    async listByOrder(orderId) {
      const { data, error } = await client
        .from("inventory_movements")
        .select("id, movement_type, quantity, sku, correlation_id, created_at, metadata")
        .contains("metadata", { orderId })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        movementType: r.movement_type as string,
        quantity: Number(r.quantity),
        sku: r.sku as string,
        correlationId: r.correlation_id as string,
        createdAt: r.created_at as string,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
      }));
    },
  };
}

export function createSupabaseStockLineageRepository(client: SupabaseClient): StockLineageRepository {
  return {
    async insertLineage(row) {
      const { data, error } = await client
        .from("stock_consumption_lineage")
        .insert({
          order_id: row.orderId,
          reservation_id: row.reservationId,
          product_id: row.productId,
          sku: row.sku,
          location_code: row.locationCode,
          consumed_qty: row.consumedQty,
          movement_id: row.movementId,
          lineage_type: row.lineageType,
          scan_reference: row.scanReference,
          gate_reference: row.gateReference,
          dispatch_lineage_id: row.dispatchLineageId,
          actor_id: row.actorId,
          actor_role: row.actorRole,
          reason_code: row.reasonCode,
          correlation_id: row.correlationId,
          metadata: row.metadata,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const d = data as Record<string, unknown>;
      return {
        id: d.id as string,
        orderId: d.order_id as string,
        reservationId: (d.reservation_id as string) ?? null,
        productId: d.product_id as string,
        sku: d.sku as string,
        locationCode: d.location_code as string,
        consumedQty: Number(d.consumed_qty),
        movementId: (d.movement_id as string) ?? null,
        lineageType: d.lineage_type as StockConsumptionLineageRecord["lineageType"],
        scanReference: (d.scan_reference as string) ?? null,
        gateReference: (d.gate_reference as string) ?? null,
        dispatchLineageId: (d.dispatch_lineage_id as string) ?? null,
        actorId: (d.actor_id as string) ?? null,
        actorRole: (d.actor_role as string) ?? null,
        reasonCode: (d.reason_code as string) ?? null,
        correlationId: d.correlation_id as string,
        metadata: (d.metadata as Record<string, unknown>) ?? {},
        createdAt: d.created_at as string,
      };
    },
    async listByOrder(orderId) {
      const { data, error } = await client
        .from("stock_consumption_lineage")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        orderId: d.order_id as string,
        reservationId: (d.reservation_id as string) ?? null,
        productId: d.product_id as string,
        sku: d.sku as string,
        locationCode: d.location_code as string,
        consumedQty: Number(d.consumed_qty),
        movementId: (d.movement_id as string) ?? null,
        lineageType: d.lineage_type as StockConsumptionLineageRecord["lineageType"],
        scanReference: (d.scan_reference as string) ?? null,
        gateReference: (d.gate_reference as string) ?? null,
        dispatchLineageId: (d.dispatch_lineage_id as string) ?? null,
        actorId: (d.actor_id as string) ?? null,
        actorRole: (d.actor_role as string) ?? null,
        reasonCode: (d.reason_code as string) ?? null,
        correlationId: d.correlation_id as string,
        metadata: (d.metadata as Record<string, unknown>) ?? {},
        createdAt: d.created_at as string,
      }));
    },
  };
}
