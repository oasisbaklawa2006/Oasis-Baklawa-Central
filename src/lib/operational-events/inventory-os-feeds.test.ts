import { describe, expect, it } from "vitest";
import { buildInventoryOsOperationalFeed } from "./inventoryOperationalFeed";
import { buildExecutionOperationalFeed } from "./executionOperationalFeed";
import { buildBarcodeOperationalFeed } from "./barcodeOperationalFeed";
import { buildGovernanceOperationalFeed } from "./governanceOperationalFeed";

describe("operational feeds (projection-only)", () => {
  it("never fabricates occurredAt on inventory OS feed rows", () => {
    const rows = buildInventoryOsOperationalFeed({
      risk: { shelfTruthUnknown: true, openReservationSignals: 0, reconciliationBacklogHint: false },
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.occurredAt === null)).toBe(true);
  });

  it("execution feed stays deterministic for a fixed satisfaction snapshot", () => {
    const a = buildExecutionOperationalFeed({
      satisfaction: {
        financeVerified: false,
        productionReady: true,
        packingComplete: true,
        barcodeReady: true,
        dispatchLabelReady: true,
      },
    });
    const b = buildExecutionOperationalFeed({
      satisfaction: {
        financeVerified: false,
        productionReady: true,
        packingComplete: true,
        barcodeReady: true,
        dispatchLabelReady: true,
      },
    });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it("barcode feed with empty scans does not invent timestamps", () => {
    const rows = buildBarcodeOperationalFeed({ scans: [], financeReleased: true });
    expect(rows.every((r) => r.occurredAt === null)).toBe(true);
  });

  it("governance feed returns matrix projection without writes", () => {
    const rows = buildGovernanceOperationalFeed({ escalationTopics: ["pricing dispute"] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.occurredAt === null)).toBe(true);
  });
});
