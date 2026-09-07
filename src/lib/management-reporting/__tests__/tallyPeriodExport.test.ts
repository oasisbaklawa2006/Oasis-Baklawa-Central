import { describe, expect, it } from "vitest";
import {
  buildExportSummaryRow,
  hashExportContent,
  verifyExportDeterminism,
} from "../tallyPeriodExport";
import type { TallyExportAuditMetadata } from "../managementReportingTypes";

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

  it("builds reproducible export summary rows from audit metadata", () => {
    const audit: TallyExportAuditMetadata = {
      exportId: "tally-v2-test",
      generatedAtIso: "2026-09-07T12:00:00.000Z",
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2026-09-30T23:59:59.999Z",
      companyId: null,
      orderCount: 3,
      lineCount: 12,
      contentHash: "deadbeef",
      source: "tally_period_export_v2",
    };
    expect(buildExportSummaryRow(audit)).toBe(
      "tally-v2-test,2026-09-07T12:00:00.000Z,2026-09-01T00:00:00.000Z,2026-09-30T23:59:59.999Z,ALL,3,12,deadbeef",
    );
  });
});
