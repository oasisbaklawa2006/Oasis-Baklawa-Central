/**
 * Read-only finance dispatch signal placeholder for Phase 4B.
 * Does NOT approve finance, mutate payment_status, generate invoices, or release orders.
 */

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
      return "Finance signal unknown (placeholder)";
    case "pending_review":
      return "Finance signal pending review";
    case "ready":
      return "Finance signal ready (read-only)";
    case "blocked":
      return "Finance signal blocked";
    default:
      return signal;
  }
}

/** Observe-only — no writes to finance tables. */
export function observeFinanceDispatchSignal(
  orderId: string,
  signal: FinanceDispatchSignal,
): { orderId: string; signal: FinanceDispatchSignal; observedAt: string } {
  return { orderId, signal, observedAt: new Date().toISOString() };
}
