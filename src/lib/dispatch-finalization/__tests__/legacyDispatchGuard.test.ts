import { describe, expect, it } from "vitest";
import {
  B2B_DISPATCH_MANAGEMENT_ROUTE,
  DISPATCH_FINALIZATION_ROUTE,
  blockLegacyB2bCartonDplMutation,
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

  it("blocks legacy B2B carton/DPL/packed-qty mutation with the governed DispatchManagement route", () => {
    const block = blockLegacyB2bCartonDplMutation("TestPage.handleSubmit");
    expect(block.blocked).toBe(true);
    expect(block.route).toBe(B2B_DISPATCH_MANAGEMENT_ROUTE);
    expect(block.route).not.toBe(DISPATCH_FINALIZATION_ROUTE);
    expect(block.message).toContain("TestPage.handleSubmit");
  });
});
