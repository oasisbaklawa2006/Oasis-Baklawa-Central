import { describe, expect, it } from "vitest";
import { describeSearchFeedAdapter } from "../searchFeedAdapter";

describe("searchFeedAdapter", () => {
  it("documents pending index kinds", () => {
    const plan = describeSearchFeedAdapter();
    expect(plan.pendingKinds).toContain("barcode");
    expect(plan.fields.some((f) => f.kind === "so_number" && f.availableNow)).toBe(true);
  });
});
