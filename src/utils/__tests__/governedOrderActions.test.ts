import { describe, expect, it } from "vitest";
import {
  GOVERNED_DIRECT_STATUSES,
  governedOrderActionDisabledReason,
  isGovernedOrderActionAvailable,
} from "@/utils/governedOrderActions";

describe("governedOrderActions", () => {
  it("allows submitted → confirmed remapping entry point", () => {
    expect(isGovernedOrderActionAvailable("submitted", "confirmed")).toBe(true);
  });

  it("allows confirmed → in_production governed production release (Point 37)", () => {
    expect(isGovernedOrderActionAvailable("confirmed", "in_production")).toBe(true);
    expect(governedOrderActionDisabledReason("confirmed", "in_production")).toBe("");
  });

  it("allows governed direct targets", () => {
    for (const status of GOVERNED_DIRECT_STATUSES) {
      expect(isGovernedOrderActionAvailable("packing", status)).toBe(true);
    }
  });

  it("disables unsupported legacy flow targets", () => {
    const blocked = [
      ["confirmed", "manufacturing"],
      ["manufacturing", "assembled"],
      ["in_production", "assembled"],
      ["assembled", "packing"],
      ["packed_ready", "awaiting_final_payment"],
      ["dispatched", "delivered"],
    ] as const;

    for (const [status, next] of blocked) {
      expect(isGovernedOrderActionAvailable(status, next)).toBe(false);
      expect(governedOrderActionDisabledReason(status, next)).toContain("not available");
    }
  });
});
