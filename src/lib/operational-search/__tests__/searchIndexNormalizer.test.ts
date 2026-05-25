import { describe, expect, it } from "vitest";
import {
  buildNormalizedTokenSet,
  expandSoPartialTokens,
  normalizeReferenceToken,
  queryTokensFromText,
} from "../searchIndexNormalizer";

describe("searchIndexNormalizer", () => {
  it("normalizes SO references with partial suffix tokens", () => {
    const partial = expandSoPartialTokens(["SO-2026-001234"]);
    expect(partial.some((t) => t.includes("1234"))).toBe(true);
  });

  it("tokenizes barcode-like strings", () => {
    const tokens = buildNormalizedTokenSet({
      title: "Carton ABC-12345",
      barcodeValues: ["ABC-12345"],
    });
    expect(tokens).toContain(normalizeReferenceToken("abc-12345"));
  });

  it("parses query tokens from SO prefix", () => {
    const tokens = queryTokensFromText("SO-2026-99");
    expect(tokens.length).toBeGreaterThan(0);
  });
});
