import type { BaseScanVerifyInput } from "./barcodeExecutionTypes";
import { detectScanMismatch } from "./scanMismatchDetection";

export interface DepartmentHandoffScanInput extends BaseScanVerifyInput {
  fromDepartment: string;
  toDepartment: string;
  expectedBarcode: string;
}

export interface DepartmentHandoffVerificationResult {
  fromDepartment: string;
  toDepartment: string;
  handoffVerified: boolean;
  mismatchReason: string | null;
}

export function evaluateDepartmentHandoffScan(
  input: DepartmentHandoffScanInput,
): DepartmentHandoffVerificationResult {
  const mismatch = detectScanMismatch({
    barcodeValue: input.barcodeValue,
    expectedBarcode: input.expectedBarcode,
  });
  return {
    fromDepartment: input.fromDepartment,
    toDepartment: input.toDepartment,
    handoffVerified: !mismatch.isMismatch,
    mismatchReason: mismatch.mismatchReason,
  };
}
