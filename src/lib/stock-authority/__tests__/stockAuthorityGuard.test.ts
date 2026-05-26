import { describe, expect, it } from "vitest";
import { assertStockAuthority, isForbiddenStockAction } from "../stockAuthorityGuard";

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
});
