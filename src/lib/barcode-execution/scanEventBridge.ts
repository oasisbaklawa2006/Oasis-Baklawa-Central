import type { OperationalStoreEventType } from "@/lib/operational-events/operationalEventTypes";
import type { ScanType, ScanVerificationStatus } from "./barcodeExecutionTypes";

export function eventTypeForScanOutcome(
  scanType: ScanType,
  status: ScanVerificationStatus,
): OperationalStoreEventType {
  if (status === "duplicate") return "scan_duplicate";

  if (scanType === "dispatch_gate") {
    if (status === "verified") return "gate_scan_verified";
    if (status === "rejected" || status === "mismatch" || status === "escalated") {
      return "gate_scan_rejected";
    }
  }

  if (scanType === "department_handoff" || scanType === "assembly_handoff") {
    if (status === "verified") return "department_handoff_verified";
    if (status === "rejected" || status === "mismatch" || status === "escalated") {
      return "department_handoff_failed";
    }
  }

  if (status === "mismatch") return "scan_mismatch";
  if (status === "verified") return "scan_verified";
  return "scan_recorded";
}

export function severityForScanStatus(status: ScanVerificationStatus): "info" | "warning" | "urgent" | "critical" {
  if (status === "mismatch" || status === "rejected") return "warning";
  if (status === "duplicate") return "info";
  if (status === "escalated") return "urgent";
  return "info";
}
