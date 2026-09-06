import { describe, expect, it } from "vitest";
import {
  assertExceptionAuthority,
  actionForCategory,
  isForbiddenExceptionAction,
} from "../exceptionAuthorityGuard";

describe("exceptionAuthorityGuard", () => {
  it("denies forbidden shadow-write actions", () => {
    expect(isForbiddenExceptionAction("exception:direct_stock_mutate")).toBe(true);
    expect(assertExceptionAuthority("exception:direct_stock_mutate", { actorRole: "ADMIN", reason: "x" }).allowed).toBe(false);
  });

  it("allows HOD to declare wastage with reason", () => {
    expect(
      assertExceptionAuthority("exception:declare_wastage", {
        actorRole: "HOD_ARABIC",
        reason: "Spoilage during shift",
      }).allowed,
    ).toBe(true);
  });

  it("denies finance roles from declaring exceptions", () => {
    expect(
      assertExceptionAuthority("exception:declare_shortage", {
        actorRole: "FINANCE_HEAD",
        reason: "short",
      }).allowed,
    ).toBe(false);
  });

  it("requires independent authorizer for QH release", () => {
    expect(
      assertExceptionAuthority("exception:release_quality_hold", {
        actorRole: "QUALITY_CONTROLLER",
        reason: "cleared",
      }).allowed,
    ).toBe(false);
    expect(
      assertExceptionAuthority("exception:release_quality_hold", {
        actorRole: "QUALITY_CONTROLLER",
        reason: "cleared",
        releaseAuthorizerRole: "QUALITY_CONTROLLER",
      }).allowed,
    ).toBe(false);
    expect(
      assertExceptionAuthority("exception:release_quality_hold", {
        actorRole: "QUALITY_CONTROLLER",
        reason: "cleared",
        releaseAuthorizerRole: "ADMIN",
      }).allowed,
    ).toBe(true);
  });

  it("requires SUPER_ADMIN override reason", () => {
    expect(
      assertExceptionAuthority("exception:declare_blocker", {
        actorRole: "SUPER_ADMIN",
        reason: "blocked",
      }).allowed,
    ).toBe(false);
    expect(
      assertExceptionAuthority("exception:declare_blocker", {
        actorRole: "SUPER_ADMIN",
        reason: "blocked",
        overrideReason: "Emergency CMD override",
      }).allowed,
    ).toBe(true);
  });

  it("maps categories to authority actions", () => {
    expect(actionForCategory("shortage")).toBe("exception:declare_shortage");
    expect(actionForCategory("quality_hold", "release")).toBe("exception:release_quality_hold");
  });
});
