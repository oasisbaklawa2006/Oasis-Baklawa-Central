import { describe, expect, it } from "vitest";
import { appendExportHistory, listExportHistory } from "../exportHistoryStore";
import type { TallyExportAuditMetadata } from "../managementReportingTypes";

const audit: TallyExportAuditMetadata = {
  exportId: "tally-v2-test",
  generatedAtIso: "2026-09-07T12:00:00.000Z",
  periodStart: "2026-09-01T00:00:00.000Z",
  periodEnd: "2026-09-30T23:59:59.999Z",
  companyId: null,
  orderCount: 1,
  lineCount: 2,
  contentHash: "abc12345",
  source: "tally_period_export_v2",
};

describe("exportHistoryStore", () => {
  it("does not throw when localStorage.setItem fails", () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("QuotaExceededError");
        },
        removeItem: () => undefined,
      },
    });

    expect(() => appendExportHistory(audit, "tally.csv")).not.toThrow();
    expect(listExportHistory()).toEqual([]);

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
  });
});
