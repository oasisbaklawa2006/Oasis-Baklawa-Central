/**
 * Dispatch finance signal — derived from Phase 4C finance governance when input provided.
 * Does NOT capture payment, generate invoices, or complete dispatch.
 */

import { deriveDispatchFinanceSignalFromGovernance } from "@/lib/finance-governance/dispatchFinanceSignalBridge";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";

export const FINANCE_DISPATCH_SIGNALS = [
  "unknown",
  "pending_review",
  "ready",
  "blocked",
] as const;

export type FinanceDispatchSignal = (typeof FINANCE_DISPATCH_SIGNALS)[number];

export function isFinanceSignalReady(signal: FinanceDispatchSignal): boolean {
  return signal === "ready";
}

export function isFinanceSignalBlocking(signal: FinanceDispatchSignal): boolean {
  return signal === "blocked";
}

export function financeSignalLabel(signal: FinanceDispatchSignal): string {
  switch (signal) {
    case "unknown":
      return "Finance signal unknown";
    case "pending_review":
      return "Finance signal pending review";
    case "ready":
      return "Finance signal ready (commercial governance)";
    case "blocked":
      return "Finance signal blocked";
    default:
      return signal;
  }
}

/** Prefer governance-derived signal when FinanceGovernanceInput is available. */
export function resolveDispatchFinanceSignal(
  governanceInput: FinanceGovernanceInput | null | undefined,
  fallback: FinanceDispatchSignal = "unknown",
): FinanceDispatchSignal {
  if (!governanceInput) return fallback;
  return deriveDispatchFinanceSignalFromGovernance(governanceInput);
}

/** Observe-only — no writes to finance tables. */
export function observeFinanceDispatchSignal(
  orderId: string,
  signal: FinanceDispatchSignal,
): { orderId: string; signal: FinanceDispatchSignal; observedAt: string } {
  return { orderId, signal, observedAt: new Date().toISOString() };
}
