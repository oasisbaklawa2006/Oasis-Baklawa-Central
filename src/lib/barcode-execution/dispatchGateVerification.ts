import type { BaseScanVerifyInput } from "./barcodeExecutionTypes";
import { detectScanMismatch } from "./scanMismatchDetection";

/** Dispatch gate scan foundation — verification only, no gate release or dispatch completion. */
export interface DispatchGateScanInput extends BaseScanVerifyInput {
  gateId: string;
  expectedBarcode: string;
}

export interface DispatchGateVerificationResult {
  gateId: string;
  allowedToProceed: boolean;
  mismatchReason: string | null;
}

export function evaluateDispatchGateScan(input: DispatchGateScanInput): DispatchGateVerificationResult {
  const mismatch = detectScanMismatch({
    barcodeValue: input.barcodeValue,
    expectedBarcode: input.expectedBarcode,
  });
  return {
    gateId: input.gateId,
    allowedToProceed: !mismatch.isMismatch,
    mismatchReason: mismatch.mismatchReason,
  };
}
