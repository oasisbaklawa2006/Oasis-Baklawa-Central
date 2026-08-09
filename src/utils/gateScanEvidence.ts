/** Stable correlation identity for a physical gate scan (carton + barcode). */
export function gateScanCorrelationId(cartonId: string, barcode: string): string {
  return `gate:${cartonId}:${barcode}`;
}

/** Initial evidence state before governed release; never mark verified until release succeeds. */
export const GATE_SCAN_PRE_RELEASE_STATUS = "scanned" as const;

export const GATE_SCAN_POST_RELEASE_STATUS = "verified" as const;

export const GATE_SCAN_RELEASE_DENIED_STATUS = "rejected" as const;
