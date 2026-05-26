import type { QueueFreshnessStatus } from "./persistentQueueTypes";

export interface QueueSlaPolicy {
  /** Hours from created/acknowledged before item is stale. */
  staleAfterHours: number;
  /** Hours until SLA breach (escalation signal). */
  breachAfterHours: number;
}

export const DEFAULT_QUEUE_SLA: Record<string, QueueSlaPolicy> = {
  finance_review_queue: { staleAfterHours: 4, breachAfterHours: 24 },
  dispatch_queue: { staleAfterHours: 2, breachAfterHours: 8 },
  customer_support_queue: { staleAfterHours: 1, breachAfterHours: 4 },
  default: { staleAfterHours: 8, breachAfterHours: 48 },
};

export interface QueueFreshnessInput {
  queueId: string;
  nowIso: string;
  createdAt: string;
  acknowledgedAt: string | null;
  slaDueAt: string | null;
}

export function deriveQueueFreshness(input: QueueFreshnessInput): QueueFreshnessStatus {
  const now = new Date(input.nowIso).getTime();
  if (input.slaDueAt) {
    const due = new Date(input.slaDueAt).getTime();
    if (now > due) return "breached";
  }
  const policy = DEFAULT_QUEUE_SLA[input.queueId] ?? DEFAULT_QUEUE_SLA.default;
  const anchor = input.acknowledgedAt ?? input.createdAt;
  const anchorMs = new Date(anchor).getTime();
  const ageHours = (now - anchorMs) / (1000 * 60 * 60);
  if (ageHours >= policy.breachAfterHours) return "breached";
  if (ageHours >= policy.staleAfterHours) return "stale";
  return "fresh";
}
