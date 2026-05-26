import { describe, expect, it } from "vitest";
import { assertDispatchAuthority, isForbiddenDispatchAction } from "../dispatchAuthorityGuard";

describe("dispatchAuthority", () => {
  it("denies finance roles", () => {
    const r = assertDispatchAuthority("dispatch:readiness_review", {
      actorRole: "FINANCE_HEAD",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(false);
  });

  it("allows DISPATCH_MANAGER for gate check", () => {
    const r = assertDispatchAuthority("dispatch:gate_check", {
      actorRole: "DISPATCH_MANAGER",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(true);
  });

  it("requires SUPER_ADMIN override reason", () => {
    const denied = assertDispatchAuthority("dispatch:readiness_review", {
      actorRole: "SUPER_ADMIN",
      actorUserId: "u1",
    });
    expect(denied.allowed).toBe(false);
    const ok = assertDispatchAuthority("dispatch:readiness_review", {
      actorRole: "SUPER_ADMIN",
      actorUserId: "u1",
      overrideReason: "CMD audit",
    });
    expect(ok.allowed).toBe(true);
  });

  it("forbids dispatch complete actions", () => {
    expect(isForbiddenDispatchAction("dispatch:complete")).toBe(true);
    expect(isForbiddenDispatchAction("dispatch:mark_dispatched")).toBe(true);
    const r = assertDispatchAuthority("dispatch:mark_dispatched", {
      actorRole: "DISPATCH_MANAGER",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(false);
  });

  it("allows OPS exception create", () => {
    const r = assertDispatchAuthority("dispatch:exception_create", {
      actorRole: "OPS",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(true);
  });
});
