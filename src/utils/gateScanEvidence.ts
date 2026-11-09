/** Stable correlation identity for a physical gate scan (carton + barcode). */
export function gateScanCorrelationId(cartonId: string, barcode: string): string {
  return `gate:${cartonId}:${barcode}`;
}

/** Initial evidence state before governed release; never mark verified until release succeeds. */
export const GATE_SCAN_PRE_RELEASE_STATUS = "scanned" as const;

export const GATE_SCAN_POST_RELEASE_STATUS = "verified" as const;

export const GATE_SCAN_RELEASE_DENIED_STATUS = "rejected" as const;

/** Escape ILIKE wildcard syntax so scanner data remains an exact literal barcode. */
export function escapeGateBarcodeIlikeLiteral(barcode: string): string {
  return barcode.replace(/[\\%_*]/g, "\\$&");
}

/** The DB unique index is case-sensitive; never select an arbitrary case-insensitive duplicate. */
export function matchUniqueCaseInsensitiveGateCarton<T extends { carton_code: string }>(
  candidates: readonly T[] | null | undefined,
  scannedBarcode: string,
): T | null {
  if (!candidates || candidates.length !== 1) return null;
  const only = candidates[0];
  return only.carton_code.toLowerCase() === scannedBarcode.toLowerCase() ? only : null;
}
