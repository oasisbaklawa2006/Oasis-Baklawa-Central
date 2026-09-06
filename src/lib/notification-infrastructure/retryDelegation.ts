import type { OutboxDeliveryRecord } from "./contract";

/**
 * Point24 retry delegation — Central does not implement retry loops or shadow outbox.
 * Failed rows remain terminal until Core/server worker applies retry policy.
 */
export const POINT24_RETRY_AUTHORITY = "oasis-supabase-core:integration-retry-policy";

export type RetryDelegationAdvice =
  | { action: "none"; reason: string }
  | { action: "delegate_point24"; reason: string; authority: string };

export function adviseOutboxRetry(record: OutboxDeliveryRecord): RetryDelegationAdvice {
  if (record.deliveryState === "pending") {
    return {
      action: "none",
      reason: "outbox_pending_awaiting_backend_worker_or_manual_process",
    };
  }
  if (record.deliveryState === "sent") {
    return { action: "none", reason: "delivery_evidenced_no_retry" };
  }
  return {
    action: "delegate_point24",
    reason: "failed_outbox_requires_core_retry_or_dead_letter_policy",
    authority: POINT24_RETRY_AUTHORITY,
  };
}
