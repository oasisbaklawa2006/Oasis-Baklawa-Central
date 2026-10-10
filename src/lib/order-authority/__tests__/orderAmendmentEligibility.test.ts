import { describe, expect, it } from "vitest";
import {
  isOrderChangeActionEligible,
  orderChangeActionDisabledReason,
  TERMINAL_ORDER_STATUSES,
} from "../orderAmendmentEligibility";

describe("orderAmendmentEligibility (Point 75)", () => {
  it("allows amend/cancel before dispatch execution cutoff", () => {
    for (const status of ["submitted", "confirmed", "in_production", "packed_ready", "cleared_for_dispatch"]) {
      expect(isOrderChangeActionEligible("amend", status)).toBe(true);
      expect(isOrderChangeActionEligible("cancel", status)).toBe(true);
    }
  });

  it("allows substitution only before packing cutoff", () => {
    expect(isOrderChangeActionEligible("substitute", "in_production")).toBe(true);
    expect(isOrderChangeActionEligible("substitute", "packing")).toBe(true);
    expect(isOrderChangeActionEligible("substitute", "packed_ready")).toBe(false);
    expect(isOrderChangeActionEligible("substitute", "cleared_for_dispatch")).toBe(false);
  });

  it("blocks all governed changes after irreversible execution", () => {
    for (const status of ["dispatched", "delivered", "closed", "cancelled"]) {
      expect(isOrderChangeActionEligible("amend", status)).toBe(false);
      expect(isOrderChangeActionEligible("cancel", status)).toBe(false);
      expect(isOrderChangeActionEligible("substitute", status)).toBe(false);
      expect(orderChangeActionDisabledReason("amend", status)).not.toBe("");
    }
  });

  it("documents terminal statuses for audit tests", () => {
    expect(TERMINAL_ORDER_STATUSES.has("cancelled")).toBe(true);
    expect(TERMINAL_ORDER_STATUSES.has("delivered")).toBe(true);
    expect(TERMINAL_ORDER_STATUSES.has("closed")).toBe(true);
  });
});
