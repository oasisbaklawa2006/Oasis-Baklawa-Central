import type { BarcodeDomain } from "./scanEventTypes";
import { TSC_TE244_99x38_PRESET } from "./labelPrintPresets";

export function buildScanPayloadPreview(input: { domain: BarcodeDomain; barcodeText: string; contextId: string }): Readonly<Record<string, unknown>> {
  return {
    schema: "scan_payload_preview_v1",
    physical: TSC_TE244_99x38_PRESET,
    domain: input.domain,
    barcodeText: input.barcodeText,
    contextId: input.contextId,
    notes: "Preview only — no scanner device integration and no persistence.",
  } as const;
}
