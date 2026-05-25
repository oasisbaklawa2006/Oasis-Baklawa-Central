import { assertScanAppendOnlyMutation } from "./scanImmutability";
import type { ScanRow } from "./barcodeExecutionTypes";
import { mapScanRow, type OperationalScanRecord } from "./barcodeExecutionTypes";

export interface InsertScanRowInput {
  scan_type: string;
  verification_type: string;
  entity_type: string;
  entity_id: string;
  order_id?: string | null;
  queue_item_id?: string | null;
  barcode_value: string;
  expected_barcode?: string | null;
  verification_status: string;
  mismatch_reason?: string | null;
  scan_source: string;
  scan_device_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  actor_department?: string | null;
  photo_evidence_url?: string | null;
  metadata?: Record<string, unknown>;
  correlation_id: string;
  idempotency_key?: string | null;
  created_at?: string;
}

export interface ScanRepository {
  insertScan(row: InsertScanRowInput): Promise<OperationalScanRecord>;
  findByIdempotencyKey(key: string): Promise<OperationalScanRecord | null>;
  getScan(id: string): Promise<OperationalScanRecord | null>;
  listRecentScans(limit?: number): Promise<OperationalScanRecord[]>;
  listScansForEntity(entityType: string, entityId: string, limit?: number): Promise<OperationalScanRecord[]>;
}

export function createInMemoryScanRepository(): ScanRepository & { _reset: () => void } {
  const scans: ScanRow[] = [];
  const byIdempotency = new Map<string, ScanRow>();

  return {
    async insertScan(row) {
      assertScanAppendOnlyMutation("insert");
      if (row.idempotency_key) {
        const existing = byIdempotency.get(row.idempotency_key);
        if (existing) return mapScanRow(existing);
      }
      const record: ScanRow = {
        id: crypto.randomUUID(),
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
        created_at: row.created_at ?? new Date().toISOString(),
      };
      scans.push(record);
      if (record.idempotency_key) byIdempotency.set(record.idempotency_key, record);
      return mapScanRow(record);
    },

    async findByIdempotencyKey(key) {
      const row = byIdempotency.get(key);
      return row ? mapScanRow(row) : null;
    },

    async getScan(id) {
      const row = scans.find((s) => s.id === id);
      return row ? mapScanRow(row) : null;
    },

    async listRecentScans(limit = 50) {
      return scans
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(mapScanRow);
    },

    async listScansForEntity(entityType, entityId, limit = 50) {
      return scans
        .filter((s) => s.entity_type === entityType && s.entity_id === entityId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(mapScanRow);
    },

    _reset() {
      scans.length = 0;
      byIdempotency.clear();
    },
  };
}
