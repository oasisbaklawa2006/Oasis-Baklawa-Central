import { describe, expect, it } from "vitest";
import {
  expectedCtnSoForOrderNumber,
  validateCtnSoBarcode,
} from "@/lib/barcode-ingest";

describe("ctnSo", () => {
  it("derives CTN-SO barcode from order number", () => {
    expect(expectedCtnSoForOrderNumber("SO-2026-000136")).toBe("CTN-SO-2026-000136");
  });

  it("accepts valid CTN-SO barcode aligned with order number", () => {
    const result = validateCtnSoBarcode({
      barcodeValue: "CTN-SO-2026-000136",
      expectedBarcode: "CTN-SO-2026-000136",
      orderNumber: "SO-2026-000136",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects barcode mismatch against expected_barcode", () => {
    const result = validateCtnSoBarcode({
      barcodeValue: "CTN-SO-2026-000999",
      expectedBarcode: "CTN-SO-2026-000136",
      orderNumber: "SO-2026-000136",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/equal expected_barcode/i);
  });

  it("rejects expected_barcode that does not match order_number", () => {
    const result = validateCtnSoBarcode({
      barcodeValue: "CTN-SO-2026-000136",
      expectedBarcode: "CTN-SO-2026-000136",
      orderNumber: "SO-2026-000999",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/order_number/i);
  });
});
