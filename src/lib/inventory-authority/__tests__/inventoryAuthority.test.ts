import { describe, expect, it } from "vitest";
import { assertInventoryReservationAuthority } from "../inventoryAuthorityGuard";
import {
  canReserveStockInGoldenChainWizard,
  roleCanPerformReservationAction,
} from "../inventoryAuthorityMatrix";

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

  it("denies dispatch reserve on reservation board channel", () => {
    const d = assertInventoryReservationAuthority("reservation:reserve", {
      actorRole: "DISPATCH_HEAD",
      actorUserId: "u1",
      writeChannel: "reservation_board",
    });
    expect(d.allowed).toBe(false);
  });

  it("allows dispatch reserve on golden_chain_operator channel", () => {
    expect(canReserveStockInGoldenChainWizard("DISPATCH_HEAD")).toBe(true);
    const d = assertInventoryReservationAuthority("reservation:create", {
      actorRole: "DISPATCH_HEAD",
      actorUserId: "u1",
      writeChannel: "golden_chain_operator",
    });
    expect(d.allowed).toBe(true);
    expect(
      roleCanPerformReservationAction("DISPATCH_HEAD", "reservation:fulfill", "golden_chain_operator"),
    ).toBe(true);
  });

  it("denies sales role on golden chain reserve", () => {
    expect(canReserveStockInGoldenChainWizard("SALES_EXECUTIVE")).toBe(false);
  });
});
