import { describe, expect, it } from "vitest";
import {
  buildReservationCreateBlockers,
  buildStockFinalizationHints,
  orderGovernanceLabel,
} from "../reservationBoardQueries";
import { summarizeAvailability } from "../buildAvailabilitySnapshot";
import { buildAvailabilitySnapshotFromBalance } from "../buildAvailabilitySnapshot";
import type { InventoryReservationRecord } from "../reservationTypes";

describe("reservationBoardQueries helpers", () => {
  it("formats governance label with SO number", () => {
    expect(orderGovernanceLabel("d6c79498-cde9-4394-b4d0-7b56d5371e85", "SO-2026-000002")).toContain("SO-2026-000002");
    expect(orderGovernanceLabel("d6c79498-cde9-4394-b4d0-7b56d5371e85", "SO-2026-000002")).toContain("1e85");
  });

  it("uses requested reserve qty for availability blockers", () => {
    const summary = summarizeAvailability(
      buildAvailabilitySnapshotFromBalance({
        productId: "p",
        sku: "S",
        balance: { availableQty: 10, reservedQty: 0 },
        openReservedQty: 0,
      }),
    );
    const blockers = buildReservationCreateBlockers({
      order: { id: "o", orderNumber: null, status: "dispatched", label: "Order o" },
      line: { productId: "p", sku: "S", productName: "X", quantity: 20 },
      reservations: [],
      availabilitySummary: summary,
      requestedQty: 4,
    });
    expect(blockers.some((b) => b.includes("Insufficient"))).toBe(false);
    const blocked = buildReservationCreateBlockers({
      order: { id: "o", orderNumber: null, status: "dispatched", label: "Order o" },
      line: { productId: "p", sku: "S", productName: "X", quantity: 20 },
      reservations: [],
      availabilitySummary: summary,
      requestedQty: 12,
    });
    expect(blocked.some((b) => b.includes("need 12"))).toBe(true);
  });

  it("blocks any open reservation for sku on order", () => {
    const summary = summarizeAvailability(
      buildAvailabilitySnapshotFromBalance({
        productId: "p",
        sku: "S",
        balance: { availableQty: 100, reservedQty: 0 },
        openReservedQty: 0,
      }),
    );
    const blockers = buildReservationCreateBlockers({
      order: { id: "o", orderNumber: null, status: "dispatched", label: "Order o" },
      line: { productId: "p", sku: "S", productName: "X", quantity: 5 },
      reservations: [
        {
          id: "r1",
          orderId: "o",
          productId: "p",
          sku: "S",
          reservationNumber: "RSV-1",
          reservationStatus: "pending",
          requestedQty: 5,
          reservedQty: 0,
          releasedQty: 0,
          fulfilledQty: 0,
          version: 1,
          sourceDepartment: null,
          notes: null,
          expiresAt: null,
          createdAt: "",
          updatedAt: "",
          queueItemId: null,
          customerId: null,
          reservationPriority: "normal",
          reservedBy: null,
          approvedBy: null,
          correlationId: "c1",
        } satisfies InventoryReservationRecord,
      ],
      availabilitySummary: summary,
    });
    expect(blockers.some((b) => b.includes("Open reservation"))).toBe(true);
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
    });
    expect(blockers.some((b) => b.includes("dispatched"))).toBe(true);
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
