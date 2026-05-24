import { describe, expect, it } from "vitest";
import { deriveInventoryVarianceEscalations } from "../inventoryRiskDerive";

describe("deriveInventoryVarianceEscalations", () => {
  it("does not emit reconciliation variance when reconciliationBacklogHint is false (order triage must not substitute)", () => {
    const rows = deriveInventoryVarianceEscalations({
      shelfTruthUnknown: true,
      openReservationSignals: 0,
      reconciliationBacklogHint: false,
    });
    expect(rows.some((r) => r.reason === "count_mismatch")).toBe(false);
  });

  it("emits reconciliation row only when caller supplies a true inventory reconciliation signal", () => {
    const rows = deriveInventoryVarianceEscalations({
      shelfTruthUnknown: false,
      openReservationSignals: 0,
      reconciliationBacklogHint: true,
    });
    expect(rows.some((r) => r.reason === "count_mismatch")).toBe(true);
  });
});
