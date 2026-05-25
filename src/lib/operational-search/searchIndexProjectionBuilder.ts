import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { QueueItemRow } from "@/lib/persistent-queues/queueRowMapper";
import { buildNormalizedTokenSet } from "./searchIndexNormalizer";
import type { SearchIndexEntry, SearchIndexEntityType, SearchIndexUpsertInput } from "./searchIndexTypes";

export interface OrderSearchSource {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  customerId?: string | null;
  customerName?: string | null;
}

export interface ScanRecordSearchSource {
  id: string;
  barcodeValue: string;
  orderId?: string | null;
  queueItemId?: string | null;
  verificationStatus: string;
  scanType: string;
}

export interface CustomerSearchSource {
  id: string;
  businessName: string;
  phone?: string | null;
  email?: string | null;
}

const UNSAFE_EVENT_TYPES = new Set([
  "queue_blocked",
  "queue_failed",
  "queue_cancelled",
  "queue_escalated",
  "scan_mismatch",
  "scan_duplicate",
  "gate_scan_rejected",
  "department_handoff_failed",
]);

function containsUnsafeText(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(" ").toLowerCase();
  return (
    blob.includes("finance hold") ||
    blob.includes("payment issue") ||
    blob.includes("escalation") ||
    blob.includes("blocker") ||
    blob.includes("mismatch") ||
    blob.includes("override")
  );
}

export function navigationPathForEntity(entityType: SearchIndexEntityType, entityId: string, orderId: string | null): string {
  switch (entityType) {
    case "order":
      return `/admin/order-management?orderId=${entityId}`;
    case "queue_item":
      return orderId
        ? `/admin/execution/production?orderId=${orderId}`
        : `/admin/live-work-queues?queueItemId=${entityId}`;
    case "operational_event":
      return orderId
        ? `/admin/customer-timeline-preview?orderId=${orderId}`
        : `/admin/execution-command-center`;
    case "scan_record":
      return `/admin/barcode-execution-preview?scanId=${entityId}`;
    case "customer":
      return `/admin/clients?customerId=${entityId}`;
    case "complaint":
      return `/admin/execution/complaints?queueItemId=${entityId}`;
    case "dispatch_reference":
      return orderId ? `/admin/dispatch-mgmt?orderId=${orderId}` : `/admin/dispatch-mgmt`;
    case "carton":
      return `/admin/label-command-center?cartonRef=${entityId}`;
    default:
      return `/admin/entity-graph-explorer`;
  }
}

export function projectOrderSearchEntry(order: OrderSearchSource): SearchIndexUpsertInput {
  const soLabel = order.orderNumber?.trim() || `SO-${order.id.slice(0, 8).toUpperCase()}`;
  const title = `Order ${soLabel}`;
  const subtitle = order.customerName ? `Customer: ${order.customerName}` : order.status ?? null;
  return {
    entityType: "order",
    entityId: order.id,
    orderId: order.id,
    customerId: order.customerId ?? null,
    queueItemId: null,
    scanRecordId: null,
    eventId: null,
    publicRef: soLabel,
    searchTitle: title,
    searchSubtitle: subtitle,
    searchBody: null,
    normalizedTokens: buildNormalizedTokenSet({
      title,
      subtitle,
      soNumbers: [soLabel, order.id],
      aliases: ["order", "so"],
    }),
    aliases: ["order", "so", soLabel.toLowerCase()],
    barcodeValues: [],
    soNumbers: [soLabel],
    phoneTokens: [],
    emailTokens: [],
    department: null,
    visibility: "customer_safe_candidate",
    sensitivity: "normal",
    source: "projection:order",
    metadata: { status: order.status ?? null },
  };
}

export function projectQueueItemSearchEntry(row: QueueItemRow): SearchIndexUpsertInput {
  const title = row.title;
  const subtitle = row.summary ?? row.queue_type;
  const unsafe = containsUnsafeText(row.blocker_summary, row.blocker_code);
  return {
    entityType: row.queue_type.includes("customer_support") ? "complaint" : "queue_item",
    entityId: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    queueItemId: row.id,
    scanRecordId: null,
    eventId: null,
    publicRef: row.order_id ? null : null,
    searchTitle: title,
    searchSubtitle: subtitle,
    searchBody: unsafe ? null : row.blocker_summary,
    normalizedTokens: buildNormalizedTokenSet({
      title,
      subtitle,
      aliases: [row.queue_type, row.state],
    }),
    aliases: [row.queue_type, row.state],
    barcodeValues: [],
    soNumbers: [],
    phoneTokens: [],
    emailTokens: [],
    department: row.owner_department,
    visibility: unsafe ? "staff_scoped" : "internal",
    sensitivity: row.escalation_level !== "none" ? "restricted" : "normal",
    source: "projection:queue_item",
    metadata: { state: row.state, queueType: row.queue_type },
  };
}

export function projectOperationalEventSearchEntry(event: OperationalStoreEventRecord): SearchIndexUpsertInput {
  const unsafeType = UNSAFE_EVENT_TYPES.has(event.eventType);
  const unsafeText = containsUnsafeText(event.title, event.message, event.reasonText);
  const visibility =
    event.visibility === "public_candidate" && !unsafeType && !unsafeText
      ? "customer_safe_candidate"
      : "internal";
  const safeTitle = unsafeType || unsafeText ? `Operational update (${event.eventType})` : `Event: ${event.eventType}`;
  return {
    entityType: "operational_event",
    entityId: event.id,
    orderId: event.orderId,
    customerId: event.customerId,
    queueItemId: event.queueItemId,
    scanRecordId: null,
    eventId: event.id,
    publicRef: null,
    searchTitle: safeTitle,
    searchSubtitle: event.entityType,
    searchBody: visibility === "internal" && !unsafeText ? event.title : null,
    normalizedTokens: buildNormalizedTokenSet({
      title: safeTitle,
      subtitle: event.eventType,
      aliases: [event.eventType, event.entityType],
    }),
    aliases: [event.eventType],
    barcodeValues: [],
    soNumbers: [],
    phoneTokens: [],
    emailTokens: [],
    department: event.actorDepartment,
    visibility,
    sensitivity: unsafeType || unsafeText ? "restricted" : "normal",
    source: "projection:operational_event",
    metadata: { eventType: event.eventType },
  };
}

export function projectScanRecordSearchEntry(scan: ScanRecordSearchSource): SearchIndexUpsertInput {
  const unsafe = ["mismatch", "duplicate", "rejected", "escalated"].includes(scan.verificationStatus);
  const title = unsafe ? `Scan ${scan.scanType}` : `Barcode ${scan.barcodeValue}`;
  return {
    entityType: scan.scanType === "carton" ? "carton" : "scan_record",
    entityId: scan.id,
    orderId: scan.orderId ?? null,
    customerId: null,
    queueItemId: scan.queueItemId ?? null,
    scanRecordId: scan.id,
    eventId: null,
    publicRef: scan.barcodeValue,
    searchTitle: title,
    searchSubtitle: scan.verificationStatus,
    searchBody: unsafe ? null : scan.barcodeValue,
    normalizedTokens: buildNormalizedTokenSet({
      title,
      barcodeValues: [scan.barcodeValue],
      aliases: [scan.scanType, scan.verificationStatus],
    }),
    aliases: [scan.scanType],
    barcodeValues: [scan.barcodeValue],
    soNumbers: [],
    phoneTokens: [],
    emailTokens: [],
    department: null,
    visibility: unsafe ? "staff_scoped" : "internal",
    sensitivity: unsafe ? "restricted" : "normal",
    source: "projection:scan_record",
    metadata: { verificationStatus: scan.verificationStatus },
  };
}

export function projectCustomerSearchEntry(customer: CustomerSearchSource): SearchIndexUpsertInput {
  const title = customer.businessName;
  return {
    entityType: "customer",
    entityId: customer.id,
    orderId: null,
    customerId: customer.id,
    queueItemId: null,
    scanRecordId: null,
    eventId: null,
    publicRef: null,
    searchTitle: title,
    searchSubtitle: "Customer",
    searchBody: null,
    normalizedTokens: buildNormalizedTokenSet({
      title,
      phoneTokens: customer.phone ? [customer.phone] : [],
      emailTokens: customer.email ? [customer.email] : [],
      aliases: ["customer", "client"],
    }),
    aliases: ["customer", "client"],
    barcodeValues: [],
    soNumbers: [],
    phoneTokens: customer.phone ? [customer.phone] : [],
    emailTokens: customer.email ? [customer.email] : [],
    department: null,
    visibility: "customer_safe_candidate",
    sensitivity: "normal",
    source: "projection:customer",
    metadata: {},
  };
}

export function projectDispatchReferenceEntry(input: {
  id: string;
  orderId: string;
  reference: string;
}): SearchIndexUpsertInput {
  const title = `Dispatch ${input.reference}`;
  return {
    entityType: "dispatch_reference",
    entityId: input.id,
    orderId: input.orderId,
    customerId: null,
    queueItemId: null,
    scanRecordId: null,
    eventId: null,
    publicRef: input.reference,
    searchTitle: title,
    searchSubtitle: "Dispatch reference",
    searchBody: null,
    normalizedTokens: buildNormalizedTokenSet({ title, aliases: ["dispatch", "shipment"] }),
    aliases: ["dispatch"],
    barcodeValues: [],
    soNumbers: [],
    phoneTokens: [],
    emailTokens: [],
    department: "dispatch",
    visibility: "customer_safe_candidate",
    sensitivity: "normal",
    source: "projection:dispatch",
    metadata: {},
  };
}

export function toResultCard(
  entry: SearchIndexEntry & { rankScore: number },
): import("./searchIndexTypes").OperationalSearchIndexResultCard {
  return {
    id: entry.id ?? entry.entityId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    orderId: entry.orderId,
    publicRef: entry.publicRef,
    searchTitle: entry.searchTitle,
    searchSubtitle: entry.searchSubtitle,
    visibility: entry.visibility,
    sensitivity: entry.sensitivity,
    source: entry.source,
    department: entry.department,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
    navigationPath: navigationPathForEntity(entry.entityType, entry.entityId, entry.orderId),
    rankScore: entry.rankScore,
  };
}
