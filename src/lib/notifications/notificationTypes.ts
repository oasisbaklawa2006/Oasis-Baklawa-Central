/**
 * Visibility-only notification model — no outbox, no send channels, no persistence.
 */

export type NotificationTopic =
  | "finance_pending"
  | "dispatch_delayed"
  | "whatsapp_stale"
  | "reservation_backend_pending"
  | "stock_visibility_unknown"
  | "label_print_pending"
  | "customer_support_window"
  | "approval_pending"
  | "factory_followup_pending";

/** How the operator should treat the row in the UI. */
export type NotificationBackendStatus = "visibility_only" | "pending_backend" | "manual_verification_required";

export type NotificationSourceFilter =
  | "all"
  | "finance"
  | "dispatch"
  | "communication"
  | "retail"
  | "inventory"
  | "labels"
  | "support"
  | "approvals"
  | "production";

export interface NotificationProjectionItem {
  /** Deterministic id for tests and dedupe (e.g. `notif-proj:finance_pending`). */
  id: string;
  topic: NotificationTopic;
  title: string;
  summary: string;
  /** UI grouping / filter chip. */
  source: NotificationSourceFilter;
  /** Always true in this foundation — no send engine. */
  visibilityOnly: true;
  backendStatus: NotificationBackendStatus;
  /** Optional human-readable hint when numeric signals are wired from other read-only surfaces. */
  signalHint?: string;
}
