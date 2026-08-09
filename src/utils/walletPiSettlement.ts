export const WALLET_PI_FAIL_CLOSED_MESSAGE =
  "Wallet PI auto-settlement requires governed finance RPC — payment fields cannot be updated directly.";

/** Wallet balance covers PI total — governed settlement RPC is still required (no direct debit). */
export function isWalletPiAutoSettleEligible(walletBalance: number, piTotal: number): boolean {
  return walletBalance - piTotal >= 0;
}
