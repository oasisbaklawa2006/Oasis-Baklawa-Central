import type { GoldenChainEvidenceRefs } from "./goldenChainTypes";

/** Deterministic operator refs — not demo flags; tied to order id and timestamp bucket. */
export function buildGoldenChainEvidenceRefs(orderId: string, orderNumber?: string | null): GoldenChainEvidenceRefs {
  const suffix = orderId.replace(/-/g, "").slice(-8).toUpperCase();
  const so = orderNumber?.trim() || `ORD-${suffix}`;
  const day = new Date().toISOString().slice(0, 10);
  return {
    packingPhotoRef: `PACK-${so}-${day}`,
    documentPlaceholderRef: `DOC-PLACEHOLDER-${suffix}`,
    gateScanRef: `GATE-SCAN-${suffix}`,
    transporterRef: `TRANSPORTER-${suffix}`,
    overrideReason: `Golden chain operator governed action — ${so}`,
  };
}
