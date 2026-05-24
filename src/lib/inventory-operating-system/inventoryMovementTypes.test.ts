import { describe, expect, it } from "vitest";
import { movementAllowsReversal, movementRequiresSupervisor } from "./inventoryMovementTypes";

describe("inventoryMovementTypes", () => {
  it("disallows reversal for dispatch, damage, expiry", () => {
    expect(movementAllowsReversal("dispatch_extraction")).toBe(false);
    expect(movementAllowsReversal("damage")).toBe(false);
    expect(movementAllowsReversal("expiry")).toBe(false);
  });

  it("allows reversal for reversible movement kinds", () => {
    expect(movementAllowsReversal("return")).toBe(true);
    expect(movementAllowsReversal("reservation_release")).toBe(true);
  });

  it("flags supervisor for sensitive movements", () => {
    expect(movementRequiresSupervisor("reconciliation")).toBe(true);
    expect(movementRequiresSupervisor("reservation_hold")).toBe(true);
    expect(movementRequiresSupervisor("production_intake")).toBe(false);
  });
});
