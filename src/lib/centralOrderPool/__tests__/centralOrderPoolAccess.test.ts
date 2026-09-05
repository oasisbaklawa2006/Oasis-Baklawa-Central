import { describe, expect, it } from "vitest";
import {
  canAccessCentralOrderPool,
  isDispatchScopedOrderPoolRole,
  visibleCentralOrderPoolLenses,
} from "@/lib/centralOrderPool/centralOrderPoolAccess";

describe("centralOrderPoolAccess POINT71", () => {
  it("grants operations managers pipeline and execution lenses without WhatsApp intake", () => {
    const lenses = visibleCentralOrderPoolLenses("OPERATIONS_MANAGER");
    expect(lenses.map((lens) => lens.key)).toEqual(
      expect.arrayContaining(["pipeline", "production", "packing", "store_coordination", "label_command", "third_party"]),
    );
    expect(lenses.some((lens) => lens.key === "intake")).toBe(false);
    expect(canAccessCentralOrderPool("OPERATIONS_MANAGER")).toBe(true);
  });

  it("denies dispatch roles the hub to preserve P0 #458 least-privilege", () => {
    expect(isDispatchScopedOrderPoolRole("DISPATCH_MANAGER")).toBe(true);
    expect(visibleCentralOrderPoolLenses("DISPATCH_MANAGER")).toEqual([]);
    expect(canAccessCentralOrderPool("DISPATCH_MANAGER")).toBe(false);
    expect(canAccessCentralOrderPool("DISPATCH_INCHARGE")).toBe(false);
    expect(canAccessCentralOrderPool("DISPATCH_HEAD")).toBe(false);
  });

  it("allows support intake without the commercial pipeline lens", () => {
    const lenses = visibleCentralOrderPoolLenses("SUPPORT_EXECUTIVE");
    expect(lenses.map((lens) => lens.key)).toEqual(expect.arrayContaining(["intake", "pipeline", "exceptions"]));
    expect(canAccessCentralOrderPool("SUPPORT_EXECUTIVE")).toBe(true);
  });

  it("denies catalogue-only roles", () => {
    expect(canAccessCentralOrderPool("CATALOGUE_CONTRIBUTOR")).toBe(false);
    expect(visibleCentralOrderPoolLenses("CATALOGUE_CONTRIBUTOR")).toEqual([]);
  });
});
