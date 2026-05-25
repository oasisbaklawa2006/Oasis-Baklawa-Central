import type { ExecutionIntelligenceInput, ScanHotspot } from "./executionIntelligenceTypes";
import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";

export function projectScanHotspots(input: ExecutionIntelligenceInput): ScanHotspot[] {
  const key = (s: { scanType: string; verificationStatus: string }) => `${s.scanType}:${s.verificationStatus}`;
  const counts = new Map<string, ScanHotspot>();

  for (const scan of input.scans) {
    const k = key(scan);
    const existing = counts.get(k);
    counts.set(k, {
      scanType: scan.scanType,
      status: scan.verificationStatus,
      count: (existing?.count ?? 0) + 1,
      latestAt:
        existing && existing.latestAt > scan.createdAt ? existing.latestAt : scan.createdAt,
    });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function listPendingGateVerifications(scans: OperationalScanRecord[]): OperationalScanRecord[] {
  return scans
    .filter((s) => s.scanType === "dispatch_gate" && s.verificationStatus !== "verified")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
}

export function countSuspiciousReplayAttempts(input: ExecutionIntelligenceInput): number {
  return input.scans.filter((s) => s.verificationStatus === "duplicate").length;
}
