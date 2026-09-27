import { supabase } from "@/integrations/supabase/client";
import { confirmPrepaidOrderAwaitingAdvance } from "@/lib/order-authority/orderAuthorityClient";
import { queueNotification } from "@/utils/notificationOutbox";

export type AdvanceNotificationDeliveryResult = {
  inAppInserted: boolean;
  outboxQueued: boolean;
  failures: string[];
};

/**
 * Delivers advance-request notifications after the governed order transition
 * has already committed. Safe to retry when transition is already applied.
 */
export async function deliverAdvancePaymentRequestNotifications(input: {
  companyId: string | null;
  message: string;
}): Promise<AdvanceNotificationDeliveryResult> {
  const failures: string[] = [];
  let inAppInserted = false;
  let outboxQueued = false;

  if (input.companyId) {
    const { error } = await supabase.from("notifications").insert({
      company_id: input.companyId,
      type: "payment_request",
      message: input.message,
    });
    if (error) {
      failures.push(`in-app notification: ${error.message}`);
    } else {
      inAppInserted = true;
    }
  } else {
    failures.push("in-app notification: company_id missing");
  }

  const queued = await queueNotification({
    eventType: "advance_requested",
    messageBody: input.message,
    priority: "high",
  });
  if (queued.queued) {
    outboxQueued = true;
  } else {
    failures.push(`outbox: ${queued.reason ?? "queue rejected"}`);
  }

  return { inAppInserted, outboxQueued, failures };
}

export type GovernedAdvanceRequestResult = {
  transitionCommitted: boolean;
  alreadyApplied: boolean;
  notifications: AdvanceNotificationDeliveryResult;
};

/**
 * Commits the governed advance transition, then attempts notification delivery
 * independently so delivery failure never masquerades as transition failure.
 */
export async function executeGovernedAdvanceRequest(input: {
  orderId: string;
  companyId: string | null;
  message: string;
}): Promise<GovernedAdvanceRequestResult> {
  const transition = await confirmPrepaidOrderAwaitingAdvance(input.orderId);
  const notifications = await deliverAdvancePaymentRequestNotifications({
    companyId: input.companyId,
    message: input.message,
  });
  return {
    transitionCommitted: true,
    alreadyApplied: Boolean(transition.already_applied),
    notifications,
  };
}
