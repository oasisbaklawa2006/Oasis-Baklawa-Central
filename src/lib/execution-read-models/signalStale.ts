import type { DerivedSignalMeta } from "./types";

/** Conservative stale threshold for governance signals (4 hours). */
export const GOVERNANCE_SIGNAL_STALE_MS = 4 * 60 * 60 * 1000;

export function deriveSignalMeta(sourceIso: string | null | undefined, nowMs = Date.now()): DerivedSignalMeta {
  if (!sourceIso) {
    return { signalGeneratedAt: null, signalAgeMs: null, stale: true };
  }
  const parsed = Date.parse(sourceIso);
  if (Number.isNaN(parsed)) {
    return { signalGeneratedAt: sourceIso, signalAgeMs: null, stale: true };
  }
  const age = Math.max(0, nowMs - parsed);
  return {
    signalGeneratedAt: sourceIso,
    signalAgeMs: age,
    stale: age > GOVERNANCE_SIGNAL_STALE_MS,
  };
}

export function downgradeIfStale<T extends string>(
  signal: T,
  meta: DerivedSignalMeta,
  readyValue: T,
  blockedValue: T,
  pendingValue: T,
): T {
  if (!meta.stale) return signal;
  if (signal === readyValue) return pendingValue;
  return blockedValue;
}
