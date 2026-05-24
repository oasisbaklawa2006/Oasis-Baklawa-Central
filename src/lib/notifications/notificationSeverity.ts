import type { OperationalEventSeverity } from "@/lib/operational-events/types";
import type { NotificationTopic } from "./notificationTypes";

/** Maps each projection topic to a display severity (not delivery priority). */
export function notificationTopicSeverity(topic: NotificationTopic): OperationalEventSeverity {
  const urgent: NotificationTopic[] = ["dispatch_delayed", "whatsapp_stale", "approval_pending"];
  const warning: NotificationTopic[] = [
    "finance_pending",
    "reservation_backend_pending",
    "stock_visibility_unknown",
    "label_print_pending",
    "factory_followup_pending",
    "customer_support_window",
  ];
  if (urgent.includes(topic)) return "urgent";
  if (warning.includes(topic)) return "warning";
  return "info";
}
