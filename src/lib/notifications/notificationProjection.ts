import type { NotificationProjectionItem, NotificationSourceFilter, NotificationTopic } from "./notificationTypes";
import { notificationTopicSeverity } from "./notificationSeverity";
import type { OperationalEventSeverity } from "@/lib/operational-events/types";

export interface NotificationProjectionCatalogOptions {
  /** Optional hints from read-only CMD / War Room windows (null = unknown / not loaded). */
  financePressureOrders?: number;
  dispatchPanicOrders?: number;
  whatsappStalePackets?: number | null;
}

function idFor(topic: NotificationTopic): string {
  return `notif-proj:${topic}`;
}

function hintFor(topic: NotificationTopic, opts: NotificationProjectionCatalogOptions): string | undefined {
  switch (topic) {
    case "finance_pending":
      return typeof opts.financePressureOrders === "number"
        ? `Finance-hold attention in current War Room window · ${opts.financePressureOrders} (bounded list — not full ledger).`
        : "Connect finance signals when ready; this row stays visibility-only.";
    case "dispatch_delayed":
      return typeof opts.dispatchPanicOrders === "number"
        ? `Dispatch panic rows in current War Room window · ${opts.dispatchPanicOrders} (bounded list).`
        : undefined;
    case "whatsapp_stale":
      if (opts.whatsappStalePackets === null) return "WhatsApp pulse not loaded — stale bucket unavailable.";
      if (typeof opts.whatsappStalePackets === "number")
        return `Stale idle bucket in latest open-packet window · ${opts.whatsappStalePackets} (bounded sample).`;
      return undefined;
    default:
      return undefined;
  }
}

function sourceFor(topic: NotificationTopic): NotificationSourceFilter {
  const map: Record<NotificationTopic, NotificationSourceFilter> = {
    finance_pending: "finance",
    dispatch_delayed: "dispatch",
    whatsapp_stale: "communication",
    reservation_backend_pending: "retail",
    stock_visibility_unknown: "inventory",
    label_print_pending: "labels",
    customer_support_window: "support",
    approval_pending: "approvals",
    factory_followup_pending: "production",
  };
  return map[topic];
}

function backendFor(topic: NotificationTopic): NotificationProjectionItem["backendStatus"] {
  if (topic === "whatsapp_stale" || topic === "finance_pending" || topic === "dispatch_delayed") {
    return "visibility_only";
  }
  return "pending_backend";
}

const TOPICS: NotificationTopic[] = [
  "finance_pending",
  "dispatch_delayed",
  "whatsapp_stale",
  "reservation_backend_pending",
  "stock_visibility_unknown",
  "label_print_pending",
  "customer_support_window",
  "approval_pending",
  "factory_followup_pending",
];

const TITLES: Record<NotificationTopic, string> = {
  finance_pending: "Finance release pending",
  dispatch_delayed: "Dispatch / packing risk",
  whatsapp_stale: "WhatsApp thread idle (stale)",
  reservation_backend_pending: "Reservation capture backend pending",
  stock_visibility_unknown: "Stock visibility unknown",
  label_print_pending: "Label print integration pending",
  customer_support_window: "Customer support window",
  approval_pending: "Approvals pending review",
  factory_followup_pending: "Factory follow-up queue pending",
};

const SUMMARIES: Record<NotificationTopic, string> = {
  finance_pending: "Orders may be waiting on finance verification — no SMS or email is sent from this module.",
  dispatch_delayed: "Escalations appear here as projections only — confirm on the ground before promising dates.",
  whatsapp_stale: "Stale packets are counted in bounded windows on the operator inbox — not a global unread total.",
  reservation_backend_pending: "Reservations are draft/local until a reviewed persistence API exists.",
  stock_visibility_unknown: "Shelf truth is not wired — treat counts as factory-row visibility, not branch promise.",
  label_print_pending: "Label Command Center emits JSON payloads only — no print jobs or drivers.",
  customer_support_window: "Post-delivery support window is informational until bound to order milestones.",
  approval_pending: "B2B / shadow approvals surface here as visibility hints — no automated outreach.",
  factory_followup_pending: "Factory follow-up integration is pending — use manual channels until backend lands.",
};

/**
 * Static projection catalog for Notification Center UI.
 * No network, no writes — optional numeric hints are display-only strings.
 */
export function buildNotificationProjectionCatalog(opts: NotificationProjectionCatalogOptions = {}): NotificationProjectionItem[] {
  return TOPICS.map((topic) => ({
    id: idFor(topic),
    topic,
    title: TITLES[topic],
    summary: SUMMARIES[topic],
    source: sourceFor(topic),
    visibilityOnly: true,
    backendStatus: backendFor(topic),
    signalHint: hintFor(topic, opts),
  }));
}

export function filterNotificationProjectionsBySource(
  items: NotificationProjectionItem[],
  source: NotificationSourceFilter,
): NotificationProjectionItem[] {
  if (source === "all") return items;
  return items.filter((i) => i.source === source);
}

export function filterNotificationProjectionsBySeverity(
  items: NotificationProjectionItem[],
  severity: OperationalEventSeverity | "all",
): NotificationProjectionItem[] {
  if (severity === "all") return items;
  return items.filter((i) => notificationTopicSeverity(i.topic) === severity);
}
