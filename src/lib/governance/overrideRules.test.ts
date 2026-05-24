import { describe, expect, it } from "vitest";
import { OVERRIDE_RULES } from "./overrideRules";

describe("OVERRIDE_RULES", () => {
  it("marks dispatch and pricing overrides as irreversible in policy table", () => {
    const dispatch = OVERRIDE_RULES.find((r) => r.kind === "dispatch_override");
    const pricing = OVERRIDE_RULES.find((r) => r.kind === "pricing_override");
    expect(dispatch?.reversible).toBe(false);
    expect(pricing?.reversible).toBe(false);
  });

  it("allows reversible stock override path", () => {
    const stock = OVERRIDE_RULES.find((r) => r.kind === "stock_override");
    expect(stock?.reversible).toBe(true);
  });
});
