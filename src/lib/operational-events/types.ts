/**
 * Unified operational event model — read-only projections for stitching timelines.
 * No persistence here; never fabricate authoritative timestamps.
 */

export type OperationalEventCategory =
  | "operational"
  | "financial"
  | "communication"
  | "escalation"
  | "dispatch"
  | "support"
  | "audit";

export type OperationalEventSeverity = "info" | "warning" | "urgent" | "critical";

export type OperationalActorRole =
  | "system"
  | "operator"
  | "customer"
  | "finance"
  | "dispatch"
  | "production"
  | "store"
  | "cmd"
  | "unknown";

export interface OperationalEventActor {
  role: OperationalActorRole;
  displayLabel?: string;
}

export type OperationalEntityType =
  | "order"
  | "whatsapp_packet"
  | "invoice"
  | "ticket"
  | "requisition"
  | "production_job"
  | "approval"
  | "store"
  | "reservation"
  | "product"
  | "document";

export interface OperationalEntityRef {
  entityType: OperationalEntityType;
  id: string;
}

export type OperationalEventSource =
  | "derived_order_trace"
  | "derived_whatsapp_inbox"
  | "derived_cmd_pulse"
  | "derived_store_coordination"
  | "derived_inventory_visibility"
  | "derived_retail_launch"
  | "derived_notification_center"
  | "derived_media_vault"
  | "notification_outbox"
  | "manual"
  | "future_event_store";

/** Notification Center — visibility projections only (no send engine). */
export const NotificationOperationalEventKind = {
  VISIBILITY_ONLY: "notification.visibility_only",
  FINANCE_PENDING: "notification.finance_pending",
  DISPATCH_DELAYED: "notification.dispatch_delayed",
  WHATSAPP_STALE: "notification.whatsapp_stale",
  APPROVAL_PENDING: "notification.approval_pending",
  FACTORY_FOLLOWUP_PENDING: "notification.factory_followup_pending",
  RESERVATION_BACKEND_PENDING: "notification.reservation_backend_pending",
  STOCK_VISIBILITY_UNKNOWN: "notification.stock_visibility_unknown",
  LABEL_PRINT_PENDING: "notification.label_print_pending",
  CUSTOMER_SUPPORT_WINDOW: "notification.customer_support_window",
} as const;

/** Media / document vault — metadata and hints only (no uploads). */
export const MediaOperationalEventKind = {
  DOCUMENT_VISIBLE: "media.document_visible",
  RECEIPT_HINT: "media.receipt_hint",
  DISPATCH_PROOF_HINT: "media.dispatch_proof_hint",
  LABEL_PREVIEW: "media.label_preview",
  WHATSAPP_ATTACHMENT_HINT: "media.whatsapp_attachment_hint",
} as const;

/** Order / dispatch / finance (existing trace builder). */
export const OperationalEventKind = {
  ORDER_CREATED: "order.created",
  PAYMENT_FINANCE_VERIFIED: "payment.finance_verified",
  PAYMENT_ADVANCE_STATE: "payment.advance_state",
  DISPATCH_VISIBILITY: "dispatch.visibility",
  STORE_REQUISITION_PENDING: "store.requisition_pending",
  PRODUCTION_JOBS_OPEN: "production.jobs_open",
  PACKING_PROGRESS: "dispatch.packing_progress",
  ORDER_LIFECYCLE_HINT: "order.lifecycle_hint",
  WHATSAPP_ORDER_CORRELATION: "whatsapp.order_correlation_hint",
} as const;

/**
 * WhatsApp kinds — dotted namespaced aliases for the same strings requested in sprint docs.
 * UI may display either; `kind` on records uses these values.
 */
export const WhatsAppOperationalEventKind = {
  MESSAGE_RECEIVED: "whatsapp.message_received",
  MESSAGE_SENT: "whatsapp.message_sent",
  PACKET_CLASSIFIED: "whatsapp.packet_classified",
  PACKET_ESCALATED: "whatsapp.packet_escalated",
  ATTACHMENT_RECEIVED: "whatsapp.attachment_received",
  STALE_THREAD: "whatsapp.stale_thread",
  OPERATOR_ASSIGNED: "whatsapp.operator_assigned",
  CUSTOMER_WAITING: "whatsapp.customer_waiting",
  NO_RESPONSE_WARNING: "whatsapp.no_response_warning",
} as const;

/** Retail / store coordination — read-only projections (no persisted events). */
export const RetailOperationalEventKind = {
  STOCK_VISIBLE: "store.stock_visible",
  STOCK_UNKNOWN: "store.stock_unknown",
  RESERVATION_REQUESTED: "store.reservation_requested",
  PICKUP_PENDING: "store.pickup_pending",
  FACTORY_FOLLOWUP_NEEDED: "store.factory_followup_needed",
  PREBOOKING_PENDING: "store.prebooking_pending",
  DELAY_WARNING: "store.delay_warning",
} as const;

/** Retail launch / pilot block — projections only (no persistence). */
export const RetailLaunchOperationalEventKind = {
  PICKUP_EXPECTED: "retail.pickup_expected",
  PICKUP_OVERDUE: "retail.pickup_overdue",
  RESERVATION_DRAFT: "retail.reservation_draft",
  MANUAL_STOCK_CHECK_REQUIRED: "retail.manual_stock_check_required",
  LABEL_PREVIEW_GENERATED: "label.preview_generated",
  FACTORY_FOLLOWUP_DRAFT: "factory.followup_draft",
} as const;

/** Inventory / ready goods — read-only visibility projections (no stock mutations). */
export const InventoryOperationalEventKind = {
  VISIBILITY_AVAILABLE: "inventory.visibility_available",
  VISIBILITY_UNKNOWN: "inventory.visibility_unknown",
  LOW_STOCK_WARNING: "inventory.low_stock_warning",
  READY_GOODS_PENDING: "inventory.ready_goods_pending",
  MANUAL_VERIFICATION_REQUIRED: "inventory.manual_verification_required",
} as const;

export interface OperationalEventRecord {
  id: string;
  kind: string;
  category: OperationalEventCategory;
  severity: OperationalEventSeverity;
  title: string;
  detail?: string;
  occurredAt: string | null;
  sortKey: number;
  actor: OperationalEventActor;
  entities: OperationalEntityRef[];
  source: OperationalEventSource;
  /** When true, timeline shows attachment affordance */
  hasAttachment?: boolean;
}
