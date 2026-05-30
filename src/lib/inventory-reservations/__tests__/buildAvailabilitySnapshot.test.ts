import { describe, expect, it } from "vitest";
import {
  buildAvailabilitySnapshotFromBalance,
  summarizeAvailability,
} from "../buildAvailabilitySnapshot";

describe("buildAvailabilitySnapshotFromBalance", () => {
  it("computes physical stock from balance slices", () => {
    const snap = buildAvailabilitySnapshotFromBalance({
      productId: "p1",
      sku: "SKU-A",
      balance: { availableQty: 40, reservedQty: 10 },
      openReservedQty: 5,
    });
    expect(snap.physicalStock).toBe(50);
    expect(snap.reservedOpen).toBe(5);
    expect(summarizeAvailability(snap).availableQty).toBe(45);
  });

  it("treats missing balance as zero physical", () => {
    const snap = buildAvailabilitySnapshotFromBalance({
      productId: "p1",
      sku: "SKU-A",
      balance: null,
      openReservedQty: 0,
    });
    expect(summarizeAvailability(snap).availableQty).toBe(0);
  });
});
