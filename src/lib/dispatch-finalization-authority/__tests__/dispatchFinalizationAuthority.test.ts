import { describe, expect, it } from "vitest";
import {
  assertDispatchFinalizationAuthority,
  isForbiddenFinalizationAction,
} from "../dispatchFinalizationAuthorityGuard";

describe("dispatchFinalizationAuthority", () => {
  it("forbids auto_finalize and bypass", () => {
    expect(isForbiddenFinalizationAction("dispatch:auto_finalize")).toBe(true);
    expect(assertDispatchFinalizationAuthority("dispatch:bypass_finance", { actorRole: "ADMIN" }).allowed).toBe(
      false,
    );
  });

  it("allows DISPATCH_HEAD finalize", () => {
    expect(assertDispatchFinalizationAuthority("dispatch:finalize", { actorRole: "DISPATCH_HEAD" }).allowed).toBe(
      true,
    );
  });

  it("denies FINANCE finalize", () => {
    expect(assertDispatchFinalizationAuthority("dispatch:finalize", { actorRole: "FINANCE_HEAD" }).allowed).toBe(
      false,
    );
  });

  it("reversal requires reason", () => {
    expect(
      assertDispatchFinalizationAuthority("dispatch:reverse_release", {
        actorRole: "DISPATCH_HEAD",
      }).allowed,
    ).toBe(false);
    expect(
      assertDispatchFinalizationAuthority("dispatch:reverse_release", {
        actorRole: "DISPATCH_HEAD",
        reversalReason: "Mis-scan",
      }).allowed,
    ).toBe(true);
  });
});
