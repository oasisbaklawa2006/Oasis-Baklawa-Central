import { describe, expect, it } from "vitest";
import { describeSearchFeedAdapter } from "../searchFeedAdapter";

describe("searchFeedAdapter", () => {
  it("documents index field contract", () => {
    const plan = describeSearchFeedAdapter();
    expect(plan.pendingKinds).not.toContain("barcode");
    expect(plan.fields.some((f) => f.kind === "barcode" && f.availableNow)).toBe(true);
    expect(plan.fields.some((f) => f.kind === "so_number" && f.availableNow)).toBe(true);
    expect(plan.notes.some((n) => n.includes("operational_search_index"))).toBe(true);
  });
});
