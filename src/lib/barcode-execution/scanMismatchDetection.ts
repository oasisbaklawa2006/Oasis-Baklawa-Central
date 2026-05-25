import { verifyBarcodeMatch } from "./barcodeVerification";

export interface MismatchDetectionInput {
  barcodeValue: string;
  expectedBarcode?: string | null;
  explicitMismatchReason?: string | null;
}

export interface MismatchDetectionResult {
  isMismatch: boolean;
  mismatchReason: string | null;
}

export function detectScanMismatch(input: MismatchDetectionInput): MismatchDetectionResult {
  if (input.explicitMismatchReason?.trim()) {
    return { isMismatch: true, mismatchReason: input.explicitMismatchReason.trim() };
  }
  const outcome = verifyBarcodeMatch({
    barcodeValue: input.barcodeValue,
    expectedBarcode: input.expectedBarcode,
  });
  if (!outcome.ok) {
    return { isMismatch: true, mismatchReason: outcome.mismatchReason };
  }
  return { isMismatch: false, mismatchReason: null };
}

export function requireMismatchReason(reason: string | null | undefined, label: string): string {
  if (!reason?.trim()) {
    throw new Error(`${label} requires a non-empty mismatch/reject reason`);
  }
  return reason.trim();
}
