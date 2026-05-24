import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import {
  NotificationOperationalEventKind,
} from "./types";
import { buildNotificationProjectionCatalog } from "@/lib/notifications/notificationProjection";
import { notificationTopicSeverity } from "@/lib/notifications/notificationSeverity";
import type { NotificationTopic } from "@/lib/notifications/notificationTypes";

const SOURCE = "derived_notification_center" as const;

const TOPIC_KIND: Record<NotificationTopic, string> = {
  finance_pending: NotificationOperationalEventKind.FINANCE_PENDING,
  dispatch_delayed: NotificationOperationalEventKind.DISPATCH_DELAYED,
  whatsapp_stale: NotificationOperationalEventKind.WHATSAPP_STALE,
  reservation_backend_pending: NotificationOperationalEventKind.RESERVATION_BACKEND_PENDING,
  stock_visibility_unknown: NotificationOperationalEventKind.STOCK_VISIBILITY_UNKNOWN,
  label_print_pending: NotificationOperationalEventKind.LABEL_PRINT_PENDING,
  customer_support_window: NotificationOperationalEventKind.CUSTOMER_SUPPORT_WINDOW,
  approval_pending: NotificationOperationalEventKind.APPROVAL_PENDING,
  factory_followup_pending: NotificationOperationalEventKind.FACTORY_FOLLOWUP_PENDING,
};

export interface NotificationFeedInput {
  financePressureOrders?: number;
  dispatchPanicOrders?: number;
  whatsappStalePackets?: number | null;
  /** When false, omit the umbrella visibility explainer row. */
  includeVisibilityExplainer?: boolean;
}

function categoryFor(topic: NotificationTopic): OperationalEventRecord["category"] {
  if (topic === "finance_pending") return "financial";
  if (topic === "dispatch_delayed") return "dispatch";
  if (topic === "whatsapp_stale") return "communication";
  if (topic === "customer_support_window") return "support";
  return "operational";
}

/**
 * Read-only notification visibility feed — no timestamps fabricated; occurredAt always null.
 */
export function buildNotificationOperationalFeed(input: NotificationFeedInput = {}): OperationalEventRecord[] {
  const catalog = buildNotificationProjectionCatalog({
    financePressureOrders: input.financePressureOrders,
    dispatchPanicOrders: input.dispatchPanicOrders,
    whatsappStalePackets: input.whatsappStalePackets,
  });
  let sortKey = 6000;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "cmd", displayLabel: "Notification visibility" };
  const out: OperationalEventRecord[] = [];

  if (input.includeVisibilityExplainer !== false) {
    out.push({
      id: "notification-center:shell:visibility_only",
      kind: NotificationOperationalEventKind.VISIBILITY_ONLY,
      category: "operational",
      severity: "info",
      title: "Notification Center — visibility only",
      detail:
        "Rows below are operational projections for staff awareness. No SMS, WhatsApp, or email is sent from this screen. No outbox, retries, or scheduling.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  for (const row of catalog) {
    const topic = row.topic;
    const severity = notificationTopicSeverity(topic);
    const detailParts = [row.summary, row.signalHint].filter(Boolean);
    out.push({
      id: `notification-center:proj:${topic}`,
      kind: TOPIC_KIND[topic],
      category: categoryFor(topic),
      severity,
      title: row.title,
      detail: detailParts.join("\n\n"),
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}

export function countHighSeverityNotificationFeed(events: OperationalEventRecord[]): number {
  return events.filter((e) => e.severity === "urgent" || e.severity === "critical").length;
}
