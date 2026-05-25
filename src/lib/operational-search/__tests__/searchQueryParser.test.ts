import { describe, expect, it } from "vitest";
import { parseOperationalSearchQuery } from "../searchQueryParser";

describe("searchQueryParser", () => {
  it("infers barcode/SO mode from SO prefix", () => {
    const p = parseOperationalSearchQuery("SO-2026-001");
    expect(p.barcodeOrSoMode).toBe(true);
    expect(p.inferredKind).toBe("so_number");
  });

  it("expands aliases for order prefix", () => {
    const p = parseOperationalSearchQuery("order:ACME");
    expect(p.tokens.length).toBeGreaterThan(0);
  });
});
