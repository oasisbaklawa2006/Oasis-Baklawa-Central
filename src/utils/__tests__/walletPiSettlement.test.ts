import { describe, expect, it } from "vitest";
import {
  isWalletPiAutoSettleEligible,
  WALLET_PI_FAIL_CLOSED_MESSAGE,
} from "@/utils/walletPiSettlement";

describe("walletPiSettlement", () => {
  it("flags sufficient wallet balance as fail-closed (no direct debit)", () => {
    expect(isWalletPiAutoSettleEligible(100_000, 80_000)).toBe(true);
    expect(WALLET_PI_FAIL_CLOSED_MESSAGE).toContain("governed finance RPC");
  });

  it("treats shortfall as non-auto-settle eligible", () => {
    expect(isWalletPiAutoSettleEligible(50_000, 80_000)).toBe(false);
  });
});
