import { describe, expect, it } from "vitest";
import {
  assertStockAuthority,
  isForbiddenStockAction,
  requiresStockOverrideReason,
} from "../stockAuthorityGuard";

describe("stockAuthorityGuard", () => {
  it("denies forbidden silent deduct", () => {
    expect(isForbiddenStockAction("stock:silent_deduct")).toBe(true);
    expect(assertStockAuthority("stock:silent_deduct", { actorRole: "INVENTORY_MANAGER" }).allowed).toBe(
      false,
    );
  });

  it("allows inventory manager finalize", () => {
    expect(
      assertStockAuthority("stock:finalize_consumption", { actorRole: "INVENTORY_MANAGER" }).allowed,
    ).toBe(true);
  });

  it("allows dispatch operator roles to finalize consumption after dispatch", () => {
    for (const actorRole of ["DISPATCH_HEAD", "DISPATCH_MANAGER", "dispatch_manager", "DISPATCH_INCHARGE"]) {
      expect(assertStockAuthority("stock:finalize_consumption", { actorRole }).allowed).toBe(true);
    }
  });

  it("denies finance", () => {
    expect(assertStockAuthority("stock:finalize_consumption", { actorRole: "FINANCE_HEAD" }).allowed).toBe(
      false,
    );
  });

  it("requires reversal reason", () => {
    expect(
      assertStockAuthority("stock:reverse_consumption", {
        actorRole: "INVENTORY_MANAGER",
        reversalReason: null,
      }).allowed,
    ).toBe(false);
    expect(
      assertStockAuthority("stock:reverse_consumption", {
        actorRole: "INVENTORY_MANAGER",
        reversalReason: "Wrong SKU picked",
      }).allowed,
    ).toBe(true);
  });

  it("denies unknown action", () => {
    expect(assertStockAuthority("stock:wildcard", { actorRole: "ADMIN" }).allowed).toBe(false);
  });

  it("requires overrideReason for SUPER_ADMIN finalize", () => {
    expect(requiresStockOverrideReason("SUPER_ADMIN")).toBe(true);
    expect(requiresStockOverrideReason("INVENTORY_MANAGER")).toBe(false);
    expect(
      assertStockAuthority("stock:finalize_consumption", {
        actorRole: "SUPER_ADMIN",
        overrideReason: null,
      }).allowed,
    ).toBe(false);
    expect(
      assertStockAuthority("stock:finalize_consumption", {
        actorRole: "SUPER_ADMIN",
        overrideReason: "Governed staging test",
      }).allowed,
    ).toBe(true);
  });
});
