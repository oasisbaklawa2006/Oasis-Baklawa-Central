import { describe, expect, it } from "vitest";
import { deriveScanAnomalies } from "./scanLifecycle";

describe("deriveScanAnomalies", () => {
  it("detects duplicate scans for same barcode text", () => {
    const anomalies = deriveScanAnomalies(
      [
        { id: "a", domain: "carton", barcodeText: "SKU-1", sequence: 1 },
        { id: "b", domain: "carton", barcodeText: "SKU-1", sequence: 2 },
      ],
      true,
    );
    expect(anomalies.some((x) => x.kind === "duplicate_scan")).toBe(true);
  });

  it("flags dispatch scans without finance release", () => {
    const anomalies = deriveScanAnomalies(
      [{ id: "d1", domain: "dispatch", barcodeText: "DPL-9", sequence: 1 }],
      false,
    );
    expect(anomalies.some((x) => x.kind === "dispatch_without_finance_release")).toBe(true);
  });

  it("reports missing barcode payload", () => {
    const anomalies = deriveScanAnomalies([{ id: "x", domain: "product", barcodeText: "  ", sequence: 1 }], true);
    expect(anomalies.some((x) => x.kind === "missing_barcode")).toBe(true);
  });

  it("returns no anomalies for empty window (no fabricated events)", () => {
    expect(deriveScanAnomalies([], true)).toHaveLength(0);
  });
});
