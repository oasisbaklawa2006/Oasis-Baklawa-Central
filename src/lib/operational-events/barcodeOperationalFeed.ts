import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import { BarcodeOperationalEventKind } from "./types";
import { deriveScanAnomalies } from "@/lib/barcode/scanLifecycle";
import type { ScanEventInput } from "@/lib/barcode/scanEventTypes";

const SOURCE = "derived_barcode_scan" as const;

export interface BarcodeOperationalFeedInput {
  scans: ScanEventInput[];
  financeReleased: boolean;
}

export function buildBarcodeOperationalFeed(input: BarcodeOperationalFeedInput): OperationalEventRecord[] {
  const anomalies = deriveScanAnomalies(input.scans, input.financeReleased);
  let sortKey = 8500;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "operator", displayLabel: "Barcode scan projection" };
  const out: OperationalEventRecord[] = [];

  if (anomalies.length === 0) {
    out.push({
      id: "barcode:scan:no_anomalies",
      kind: BarcodeOperationalEventKind.SCAN_ANOMALY,
      category: "operational",
      severity: "info",
      title: "No scan anomalies in supplied window",
      detail: "Caller supplied zero scan rows — no duplicate, ordering, or finance gating anomalies to report.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  for (const a of anomalies) {
    const kind =
      a.kind === "duplicate_scan"
        ? BarcodeOperationalEventKind.SCAN_DUPLICATE
        : a.kind === "out_of_order_scan"
          ? BarcodeOperationalEventKind.SCAN_OUT_OF_ORDER
          : a.kind === "missing_barcode"
            ? BarcodeOperationalEventKind.SCAN_MISSING
            : a.kind === "dispatch_without_finance_release"
              ? BarcodeOperationalEventKind.DISPATCH_MISMATCH
              : BarcodeOperationalEventKind.SCAN_ANOMALY;
    out.push({
      id: `barcode:anomaly:${a.kind}:${a.relatedScanIds.join(":")}`,
      kind,
      category: "audit",
      severity: a.kind === "dispatch_without_finance_release" ? "urgent" : "warning",
      title: `Scan anomaly · ${a.kind.replace(/_/g, " ")}`,
      detail: a.detail,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: a.relatedScanIds.map((id) => ({ entityType: "carton" as const, id })),
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}
