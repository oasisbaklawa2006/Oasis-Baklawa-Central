import type { OperationalScanRecord, VerificationType } from "./barcodeExecutionTypes";

export const DEFAULT_DUPLICATE_SCAN_WINDOW_MS = 60_000;

export interface DuplicateScanCheckInput {
  barcodeValue: string;
  entityType: string;
  entityId: string;
  verificationType: VerificationType;
  recentScans: OperationalScanRecord[];
  windowMs?: number;
  nowMs?: number;
}

export interface DuplicateScanCheckResult {
  isDuplicate: boolean;
  duplicateOfScanId: string | null;
}

export function detectDuplicateScan(input: DuplicateScanCheckInput): DuplicateScanCheckResult {
  const windowMs = input.windowMs ?? DEFAULT_DUPLICATE_SCAN_WINDOW_MS;
  const now = input.nowMs ?? Date.now();
  const normalized = input.barcodeValue.trim().toUpperCase();
  const cutoff = now - windowMs;

  for (const scan of input.recentScans) {
    if (scan.verificationStatus === "duplicate") continue;
    if (scan.entityType !== input.entityType || scan.entityId !== input.entityId) continue;
    if (scan.verificationType !== input.verificationType) continue;
    if (scan.barcodeValue.trim().toUpperCase() !== normalized) continue;
    const created = new Date(scan.createdAt).getTime();
    if (created >= cutoff) {
      return { isDuplicate: true, duplicateOfScanId: scan.id };
    }
  }
  return { isDuplicate: false, duplicateOfScanId: null };
}
