import { describe, expect, it } from "vitest";
import { hashExportContent, verifyExportDeterminism } from "../tallyPeriodExport";

describe("tallyPeriodExport determinism", () => {
  it("produces stable content hash for identical CSV body", () => {
    const csv = "order_id,amount\no1,100.00\no2,200.00";
    const h1 = hashExportContent(csv);
    const h2 = hashExportContent(csv);
    expect(verifyExportDeterminism(h1, h2)).toBe(true);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it("changes hash when export body changes", () => {
    const h1 = hashExportContent("a,b\n1,2");
    const h2 = hashExportContent("a,b\n1,3");
    expect(verifyExportDeterminism(h1, h2)).toBe(false);
  });
});
