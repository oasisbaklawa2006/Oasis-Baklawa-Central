/**
 * Read-only timing heuristics for operator/CMD surfaces.
 * No side effects; no notifications; thresholds are conservative UX hints only.
 */

const HOUR_MS = 3600_000;

export interface CustomerWaitingSignal {
  active: boolean;
  hoursSinceLastCustomerInbound: number | null;
  severity: "info" | "warning" | "urgent";
}

/** Last inbound message age when thread ends with customer message (waiting on us). */
export function deriveCustomerWaitingSignal(
  lastInboundAtIso: string | null,
  isLastMessageInbound: boolean,
  now = Date.now(),
): CustomerWaitingSignal {
  if (!isLastMessageInbound || !lastInboundAtIso) {
    return { active: false, hoursSinceLastCustomerInbound: null, severity: "info" };
  }
  const t = new Date(lastInboundAtIso).getTime();
  if (Number.isNaN(t)) {
    return { active: false, hoursSinceLastCustomerInbound: null, severity: "info" };
  }
  const hours = (now - t) / HOUR_MS;
  let severity: CustomerWaitingSignal["severity"] = "info";
  if (hours >= 24) severity = "urgent";
  else if (hours >= 2) severity = "warning";
  return {
    active: hours >= 2,
    hoursSinceLastCustomerInbound: Math.round(hours * 10) / 10,
    severity,
  };
}

export interface NoResponseWarningSignal {
  active: boolean;
  hoursSinceLastInbound: number | null;
}

export function deriveNoResponseWarning(
  lastInboundAtIso: string | null,
  isLastMessageInbound: boolean,
  now = Date.now(),
): NoResponseWarningSignal {
  if (!isLastMessageInbound || !lastInboundAtIso) {
    return { active: false, hoursSinceLastInbound: null };
  }
  const t = new Date(lastInboundAtIso).getTime();
  if (Number.isNaN(t)) return { active: false, hoursSinceLastInbound: null };
  const hours = (now - t) / HOUR_MS;
  return {
    active: hours >= 8,
    hoursSinceLastInbound: Math.round(hours * 10) / 10,
  };
}
