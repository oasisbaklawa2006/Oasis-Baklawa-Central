import { describe, expect, it } from "vitest";
import { assertInventoryReservationAuthority } from "../inventoryAuthorityGuard";

describe("inventoryAuthority", () => {
  it("denies finance roles", () => {
    const d = assertInventoryReservationAuthority("reservation:reserve", {
      actorRole: "FINANCE_HEAD",
      actorUserId: "u1",
    });
    expect(d.allowed).toBe(false);
  });

  it("denies dispatch fulfill", () => {
    const d = assertInventoryReservationAuthority("reservation:fulfill", {
      actorRole: "DISPATCH_MANAGER",
      actorUserId: "u1",
    });
    expect(d.allowed).toBe(false);
  });

  it("allows super admin override with reason", () => {
    const d = assertInventoryReservationAuthority("reservation:override", {
      actorRole: "SUPER_ADMIN",
      actorUserId: "u1",
      overrideReason: "audit correction",
    });
    expect(d.allowed).toBe(true);
  });

  it("denies unknown action", () => {
    const d = assertInventoryReservationAuthority("reservation:wildcard", {
      actorRole: "SUPER_ADMIN",
      actorUserId: "u1",
    });
    expect(d.allowed).toBe(false);
  });
});
