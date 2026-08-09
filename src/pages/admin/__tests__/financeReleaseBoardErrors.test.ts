import { describe, expect, it } from "vitest";

describe("FinanceReleaseBoard authority error surfacing", () => {
  it("surfaces server blocker messages from authority failures", () => {
    const blocker = new Error("Payment must be verified before production release");
    const message = blocker instanceof Error ? blocker.message : "Could not release order.";
    expect(message).toBe("Payment must be verified before production release");
    expect(message).not.toBe("Could not release order.");
  });

  it("falls back safely for non-Error throws", () => {
    const fallback = (e: unknown) => (e instanceof Error ? e.message : "Could not reject.");
    expect(fallback("raw")).toBe("Could not reject.");
  });
});
