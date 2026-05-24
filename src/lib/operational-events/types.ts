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
  | "carton"
  | "movement";

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
  | "derived_inventory_os"
  | "derived_barcode_scan"
  | "derived_execution_engine"
  | "derived_governance"
  | "derived_write_intent"
  | "notification_outbox"
  | "manual"
  | "future_event_store";

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
  OS_LEDGER_PRINCIPLES: "inventory.os_ledger_principles",
  VARIANCE_DETECTED: "inventory.variance_detected",
  RESERVATION_PENDING: "inventory.reservation_pending",
  MOVEMENT_PROJECTED: "inventory.movement_projected",
} as const;

/** Barcode scan lifecycle — projections only (no device I/O). */
export const BarcodeOperationalEventKind = {
  SCAN_DUPLICATE: "barcode.scan_duplicate",
  SCAN_OUT_OF_ORDER: "barcode.scan_out_of_order",
  SCAN_MISSING: "barcode.scan_missing",
  DISPATCH_MISMATCH: "barcode.dispatch_mismatch",
  SCAN_ANOMALY: "barcode.scan_anomaly",
} as const;

/** Execution dependency engine — no auto execution. */
export const ExecutionOperationalEventKind = {
  DISPATCH_BLOCKED: "execution.dispatch_blocked",
  BOTTLENECK_DETECTED: "execution.bottleneck_detected",
  DEPENDENCY_UNSATISFIED: "execution.dependency_unsatisfied",
} as const;

/** Governance / approvals — policy projection only. */
export const GovernanceOperationalEventKind = {
  OVERRIDE_REQUIRED: "governance.override_required",
  ESCALATION_PENDING: "governance.escalation_pending",
  PROTECTED_TRANSITION: "governance.protected_transition",
} as const;

/** Controlled write activation — projection-only intent signals (no adapter execution). */
export const WriteIntentOperationalEventKind = {
  INTENT_PREVIEWED: "write.intent_previewed",
  PREFLIGHT_BLOCKED: "write.preflight_blocked",
  AUDIT_ENVELOPE_READY: "write.audit_envelope_ready",
  FEATURE_FLAG_DISABLED: "write.feature_flag_disabled",
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
