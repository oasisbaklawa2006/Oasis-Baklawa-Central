import type { ScanAnomalyKind, ScanEventInput } from "./scanEventTypes";

export interface ScanAnomaly {
  kind: ScanAnomalyKind;
  detail: string;
  relatedScanIds: string[];
}

/**
 * Pure anomaly derivation — no hardware, no persistence.
 */
export function deriveScanAnomalies(events: ScanEventInput[], financeReleased: boolean): ScanAnomaly[] {
  const anomalies: ScanAnomaly[] = [];
  const byText = new Map<string, ScanEventInput[]>();
  for (const e of events) {
    const k = e.barcodeText.trim().toLowerCase();
    if (!k) {
      anomalies.push({ kind: "missing_barcode", detail: `Scan ${e.id} has empty payload`, relatedScanIds: [e.id] });
      continue;
    }
    const list = byText.get(k) ?? [];
    list.push(e);
    byText.set(k, list);
  }
  for (const [, list] of byText) {
    if (list.length > 1) {
      anomalies.push({
        kind: "duplicate_scan",
        detail: `Barcode repeated ${list.length} times in window`,
        relatedScanIds: list.map((x) => x.id),
      });
    }
    const sorted = [...list].sort((a, b) => a.sequence - b.sequence);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.sequence < sorted[i - 1]!.sequence) {
        anomalies.push({
          kind: "out_of_order_scan",
          detail: "Sequence regression detected for same barcode text",
          relatedScanIds: [sorted[i - 1]!.id, sorted[i]!.id],
        });
      }
    }
  }
  const dispatchScans = events.filter((e) => e.domain === "dispatch");
  if (dispatchScans.length > 0 && !financeReleased) {
    anomalies.push({
      kind: "dispatch_without_finance_release",
      detail: "Dispatch-domain scan present while finance release flag is false (policy projection).",
      relatedScanIds: dispatchScans.map((e) => e.id),
    });
  }
  return anomalies;
}
