import { describe, expect, it } from "vitest";
import { normalizeBarcode, verifyBarcodeMatch } from "../barcodeVerification";

describe("barcodeVerification", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeBarcode("  ab-12  ")).toBe("AB-12");
  });

  it("passes when expected matches", () => {
    const r = verifyBarcodeMatch({ barcodeValue: "OB 001", expectedBarcode: "ob001" });
    expect(r.ok).toBe(true);
  });

  it("fails on mismatch", () => {
    const r = verifyBarcodeMatch({ barcodeValue: "A", expectedBarcode: "B" });
    expect(r.ok).toBe(false);
    expect(r.mismatchReason).toMatch(/mismatch/i);
  });
});
