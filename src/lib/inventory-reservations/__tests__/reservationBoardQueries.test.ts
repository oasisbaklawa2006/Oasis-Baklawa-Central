import { describe, expect, it } from "vitest";
import {
  buildReservationCreateBlockers,
  buildStockFinalizationHints,
  orderGovernanceLabel,
} from "../reservationBoardQueries";
import { summarizeAvailability } from "../buildAvailabilitySnapshot";
import { buildAvailabilitySnapshotFromBalance } from "../buildAvailabilitySnapshot";

describe("reservationBoardQueries helpers", () => {
  it("formats governance label with SO number", () => {
    expect(orderGovernanceLabel("d6c79498-cde9-4394-b4d0-7b56d5371e85", "SO-2026-000002")).toContain("SO-2026-000002");
    expect(orderGovernanceLabel("d6c79498-cde9-4394-b4d0-7b56d5371e85", "SO-2026-000002")).toContain("1e85");
  });

  it("blocks non-dispatched orders", () => {
    const summary = summarizeAvailability(
      buildAvailabilitySnapshotFromBalance({
        productId: "p",
        sku: "S",
        balance: { availableQty: 100, reservedQty: 0 },
        openReservedQty: 0,
      }),
    );
    const blockers = buildReservationCreateBlockers({
      order: { id: "o", orderNumber: null, status: "cleared_for_dispatch", label: "Order o" },
      line: { productId: "p", sku: "S", productName: "X", quantity: 5 },
      reservations: [],
      availabilitySummary: summary,
      reserveQty: 3,
    });
    expect(blockers.some((b) => b.includes("dispatched"))).toBe(true);
    expect(blockers.some((b) => b.includes("need 3"))).toBe(false);
  });

  it("uses reserveQty for availability check", () => {
    const summary = summarizeAvailability(
      buildAvailabilitySnapshotFromBalance({
        productId: "p",
        sku: "S",
        balance: { availableQty: 4, reservedQty: 0 },
        openReservedQty: 0,
      }),
    );
    const blockers = buildReservationCreateBlockers({
      order: { id: "o", orderNumber: null, status: "dispatched", label: "Order o" },
      line: { productId: "p", sku: "S", productName: "X", quantity: 10 },
      reservations: [],
      availabilitySummary: summary,
      reserveQty: 5,
    });
    expect(blockers.some((b) => b.includes("need 5"))).toBe(true);
    expect(blockers.some((b) => b.includes("need 10"))).toBe(false);
  });

  it("lists 4G prerequisite hints", () => {
    const hints = buildStockFinalizationHints({
      hasBalance: false,
      hasVerifiedScan: false,
      hasReservedLine: false,
      locationCode: "WH-MAIN",
    });
    expect(hints.length).toBe(3);
  });
});
