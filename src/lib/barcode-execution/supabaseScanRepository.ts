import type { SupabaseClient } from "@supabase/supabase-js";
import { assertScanAppendOnlyMutation } from "./scanImmutability";
import type { InsertScanRowInput, ScanRepository } from "./scanRepository";
import { mapScanRow, type ScanRow } from "./barcodeExecutionTypes";

export function createSupabaseScanRepository(client: SupabaseClient): ScanRepository {
  return {
    async insertScan(row: InsertScanRowInput) {
      assertScanAppendOnlyMutation("insert");
      if (row.idempotency_key) {
        const existing = await this.findByIdempotencyKey(row.idempotency_key);
        if (existing) return existing;
      }
      const { data, error } = await client
        .from("operational_scan_records")
        .insert({
          scan_type: row.scan_type,
          verification_type: row.verification_type,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          order_id: row.order_id ?? null,
          queue_item_id: row.queue_item_id ?? null,
          barcode_value: row.barcode_value,
          expected_barcode: row.expected_barcode ?? null,
          verification_status: row.verification_status,
          mismatch_reason: row.mismatch_reason ?? null,
          scan_source: row.scan_source,
          scan_device_id: row.scan_device_id ?? null,
          actor_id: row.actor_id ?? null,
          actor_role: row.actor_role ?? null,
          actor_department: row.actor_department ?? null,
          photo_evidence_url: row.photo_evidence_url ?? null,
          metadata: row.metadata ?? {},
          correlation_id: row.correlation_id,
          idempotency_key: row.idempotency_key ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapScanRow(data as ScanRow);
    },

    async findByIdempotencyKey(key) {
      const { data, error } = await client
        .from("operational_scan_records")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapScanRow(data as ScanRow) : null;
    },

    async getScan(id) {
      const { data, error } = await client
        .from("operational_scan_records")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapScanRow(data as ScanRow) : null;
    },

    async listRecentScans(limit = 50) {
      const { data, error } = await client
        .from("operational_scan_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ScanRow[]).map(mapScanRow);
    },

    async listScansForEntity(entityType, entityId, limit = 50) {
      const { data, error } = await client
        .from("operational_scan_records")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ScanRow[]).map(mapScanRow);
    },
  };
}
