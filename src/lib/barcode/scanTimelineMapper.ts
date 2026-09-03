import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";
import type { BarcodeDomain, ScanEventInput } from "./scanEventTypes";

/** Map persisted scan_type values to barcode lifecycle domains for anomaly derivation. */
export function mapScanTypeToDomain(scanType: string): BarcodeDomain {
  switch (scanType) {
    case "dispatch_gate":
      return "dispatch";
    case "carton":
      return "carton";
    case "department_handoff":
    case "assembly_handoff":
      return "transfer";
    case "ready_goods_intake":
      return "reservation";
    case "order":
      return "product";
    default:
      return "product";
  }
}

/** Chronological ScanEventInput rows for pure anomaly derivation (read-only). */
export function mapOperationalScansToEventInputs(scans: OperationalScanRecord[]): ScanEventInput[] {
  const sorted = [...scans].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return sorted.map((scan, index) => ({
    id: scan.id,
    domain: mapScanTypeToDomain(scan.scanType),
    barcodeText: scan.barcodeValue,
    sequence: index + 1,
  }));
}

export interface ScanTimelineRow {
  id: string;
  createdAt: string;
  scanType: string;
  verificationStatus: string;
  barcodeValue: string;
  expectedBarcode: string | null;
  orderId: string | null;
  scanSource: string;
  idempotencyKey: string | null;
  mismatchReason: string | null;
  actorRole: string | null;
}

export function mapToTimelineRow(scan: OperationalScanRecord): ScanTimelineRow {
  return {
    id: scan.id,
    createdAt: scan.createdAt,
    scanType: scan.scanType,
    verificationStatus: scan.verificationStatus,
    barcodeValue: scan.barcodeValue,
    expectedBarcode: scan.expectedBarcode,
    orderId: scan.orderId,
    scanSource: scan.scanSource,
    idempotencyKey: scan.idempotencyKey,
    mismatchReason: scan.mismatchReason,
    actorRole: scan.actorRole,
  };
}
