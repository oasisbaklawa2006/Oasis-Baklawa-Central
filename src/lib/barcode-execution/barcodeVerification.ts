export interface BarcodeVerificationInput {
  barcodeValue: string;
  expectedBarcode?: string | null;
}

export interface BarcodeVerificationOutcome {
  ok: boolean;
  normalizedActual: string;
  normalizedExpected: string | null;
  mismatchReason: string | null;
}

export function normalizeBarcode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function verifyBarcodeMatch(input: BarcodeVerificationInput): BarcodeVerificationOutcome {
  const actual = normalizeBarcode(input.barcodeValue);
  if (!actual) {
    return {
      ok: false,
      normalizedActual: actual,
      normalizedExpected: null,
      mismatchReason: "Empty barcode value",
    };
  }
  const expectedRaw = input.expectedBarcode?.trim();
  if (!expectedRaw) {
    return {
      ok: true,
      normalizedActual: actual,
      normalizedExpected: null,
      mismatchReason: null,
    };
  }
  const expected = normalizeBarcode(expectedRaw);
  if (actual === expected) {
    return {
      ok: true,
      normalizedActual: actual,
      normalizedExpected: expected,
      mismatchReason: null,
    };
  }
  return {
    ok: false,
    normalizedActual: actual,
    normalizedExpected: expected,
    mismatchReason: `Barcode mismatch: scanned ${actual}, expected ${expected}`,
  };
}
