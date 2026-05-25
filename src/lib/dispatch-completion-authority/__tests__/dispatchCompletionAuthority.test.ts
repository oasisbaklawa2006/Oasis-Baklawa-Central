import { describe, expect, it } from "vitest";
import {
  assertDispatchCompletionAuthority,
  isForbiddenCompletionAction,
} from "../dispatchCompletionAuthorityGuard";

describe("dispatchCompletionAuthority", () => {
  it("forbids raw mark_dispatched", () => {
    expect(isForbiddenCompletionAction("dispatch:mark_dispatched")).toBe(true);
    const r = assertDispatchCompletionAuthority("dispatch:mark_dispatched", {
      actorRole: "DISPATCH_MANAGER",
    });
    expect(r.allowed).toBe(false);
  });

  it("allows attest for dispatch manager", () => {
    const r = assertDispatchCompletionAuthority("dispatch:attest_completion", {
      actorRole: "DISPATCH_MANAGER",
    });
    expect(r.allowed).toBe(true);
  });

  it("requires override reason for super admin", () => {
    const denied = assertDispatchCompletionAuthority("dispatch:attest_completion", {
      actorRole: "SUPER_ADMIN",
    });
    expect(denied.allowed).toBe(false);
    const ok = assertDispatchCompletionAuthority("dispatch:attest_completion", {
      actorRole: "SUPER_ADMIN",
      overrideReason: "Emergency staging attestation",
    });
    expect(ok.allowed).toBe(true);
  });
});
