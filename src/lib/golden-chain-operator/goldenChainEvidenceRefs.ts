import type { GoldenChainEvidenceRefs } from "./goldenChainTypes";

export interface GoldenChainScanHints {
  cartonBarcode?: string | null;
  gateBarcode?: string | null;
}

/** Deterministic operator refs — tied to SO number; scan barcodes override gate/handoff when present. */
export function buildGoldenChainEvidenceRefs(
  orderId: string,
  orderNumber?: string | null,
  scans?: GoldenChainScanHints,
): GoldenChainEvidenceRefs {
  const so =
    orderNumber?.trim() ||
    `ORD-${orderId.replace(/-/g, "").slice(-8).toUpperCase()}`;
  const normalizedSo = so.startsWith("SO-") ? so : so;
  const gateScan =
    scans?.gateBarcode?.trim() ||
    scans?.cartonBarcode?.trim() ||
    `GATE-${normalizedSo}`;
  const carton = scans?.cartonBarcode?.trim();
  return {
    packingPhotoRef: `PACKING-${normalizedSo}`,
    documentPlaceholderRef: `DOC-SLOT-${normalizedSo}`,
    gateScanRef: gateScan,
    transporterRef: carton ? `HANDOFF-${carton}` : `HANDOFF-${normalizedSo}`,
    stockFinalizeReason: `AUTO-4G-${normalizedSo}`,
    overrideReason: "",
  };
}
