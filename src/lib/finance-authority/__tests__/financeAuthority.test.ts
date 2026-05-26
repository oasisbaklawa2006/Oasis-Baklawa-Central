import { describe, expect, it } from "vitest";
import { assertFinanceAuthority, isForbiddenFinanceAction } from "../financeAuthorityGuard";

describe("financeAuthority", () => {
  it("forbids payment capture action", () => {
    expect(isForbiddenFinanceAction("finance:capture_payment")).toBe(true);
    const r = assertFinanceAuthority("finance:capture_payment", {
      actorRole: "FINANCE_HEAD",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(false);
  });

  it("allows FINANCE_HEAD commercial release", () => {
    const r = assertFinanceAuthority("finance:commercial_release", {
      actorRole: "FINANCE_HEAD",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(true);
  });

  it("limits FINANCE_EXEC from commercial release", () => {
    const r = assertFinanceAuthority("finance:commercial_release", {
      actorRole: "FINANCE_EXEC",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(false);
  });

  it("denies dispatch roles", () => {
    const r = assertFinanceAuthority("finance:review", {
      actorRole: "DISPATCH_MANAGER",
      actorUserId: "u1",
    });
    expect(r.allowed).toBe(false);
  });
});
