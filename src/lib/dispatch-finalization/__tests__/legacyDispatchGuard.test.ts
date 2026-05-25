import { describe, expect, it } from "vitest";
import {
  DISPATCH_FINALIZATION_ROUTE,
  blockLegacyDispatchStatusMutation,
  isDispatchedStatusMutation,
} from "../legacyDispatchGuard";

describe("legacyDispatchGuard", () => {
  it("blocks legacy mutation with finalization route", () => {
    const block = blockLegacyDispatchStatusMutation("TestPage");
    expect(block.blocked).toBe(true);
    expect(block.route).toBe(DISPATCH_FINALIZATION_ROUTE);
    expect(block.message).toContain("TestPage");
  });

  it("detects dispatched status target", () => {
    expect(isDispatchedStatusMutation("dispatched")).toBe(true);
    expect(isDispatchedStatusMutation("cleared_for_dispatch")).toBe(false);
  });
});
