import type { ScanVerificationStatus } from "./barcodeExecutionTypes";

export type ScanLifecycleAction = "record" | "verify" | "reject" | "escalate";

const TRANSITIONS: Record<ScanVerificationStatus, Partial<Record<ScanLifecycleAction, ScanVerificationStatus>>> = {
  scanned: { verify: "verified", reject: "rejected" },
  verified: { escalate: "escalated" },
  mismatch: { reject: "rejected", escalate: "escalated" },
  duplicate: {},
  rejected: { escalate: "escalated" },
  escalated: {},
};

export function applyScanLifecycleTransition(
  from: ScanVerificationStatus,
  action: ScanLifecycleAction,
): ScanVerificationStatus | null {
  return TRANSITIONS[from]?.[action] ?? null;
}

export function isTerminalScanStatus(status: ScanVerificationStatus): boolean {
  return status === "verified" || status === "duplicate" || status === "escalated";
}
