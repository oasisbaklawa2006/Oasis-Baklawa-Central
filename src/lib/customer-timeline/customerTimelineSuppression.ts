import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

/** Permanent suppression terms — title, message, metadata, reasons, actor, department. */
export const CUSTOMER_TIMELINE_SUPPRESSED_TERMS = [
  "finance hold",
  "payment issue",
  "credit issue",
  "escalation",
  "panic",
  "urgent internal",
  "blocker",
  "delay reason",
  "staff name",
  "department conflict",
  "blame",
  "governance",
  "rejection",
  "mismatch",
  "duplicate scan",
  "gate rejected",
  "failed",
  "cancelled",
  "canceled",
  "super admin",
  "override",
  "audit",
  "rls",
  "internal",
  "ops",
  "cmd",
  "war room",
  "finance",
  "payment",
  "invoice hold",
  "stock",
  "reservation",
  "hod",
  "manager",
  "incharge",
  "accountability",
  "verification pending",
  "scan_duplicate",
  "scan_mismatch",
  "queue_failed",
  "queue_cancelled",
  "queue_blocked",
  "queue_escalated",
  "operational_note",
  "actor",
  "correlation",
  "idempotency",
] as const;

/** High-risk phrases in title/message — excludes bare staff labels like "internal" in routine ops titles. */
export const CUSTOMER_TIMELINE_TITLE_MESSAGE_RISK_TERMS = [
  "finance hold",
  "payment issue",
  "credit issue",
  "escalation",
  "panic",
  "urgent internal",
  "blocker",
  "delay reason",
  "department conflict",
  "blame",
  "governance",
  "rejection",
  "mismatch",
  "duplicate scan",
  "gate rejected",
  "failed",
  "cancelled",
  "canceled",
  "super admin",
  "override",
  "audit",
  "rls",
  "war room",
  "invoice hold",
  "accountability",
  "verification pending",
] as const;

export function textContainsSuppressedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return CUSTOMER_TIMELINE_SUPPRESSED_TERMS.some((term) => lower.includes(term));
}

export function titleOrMessageContainsRiskTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return CUSTOMER_TIMELINE_TITLE_MESSAGE_RISK_TERMS.some((term) => lower.includes(term));
}

function stringifyMetadata(metadata: Record<string, unknown>): string {
  try {
    return JSON.stringify(metadata);
  } catch {
    return "";
  }
}

export function isEventSuppressedForCustomer(event: OperationalStoreEventRecord): boolean {
  const titleMessageFields = [event.title, event.message ?? ""];
  const structuredFields = [
    event.reasonCode ?? "",
    event.reasonText ?? "",
    event.actorRole ?? "",
    event.actorDepartment ?? "",
    stringifyMetadata(event.metadata),
  ];

  if (event.visibility === "public_candidate") {
    if (titleMessageFields.some(textContainsSuppressedTerm)) return true;
  } else if (titleMessageFields.some(titleOrMessageContainsRiskTerm)) {
    return true;
  }

  if (structuredFields.some(textContainsSuppressedTerm)) return true;

  const structuredBlob = [...structuredFields, event.eventType].join(" ");
  if (textContainsSuppressedTerm(structuredBlob)) return true;

  const alwaysSuppressTypes = new Set([
    "queue_blocked",
    "queue_failed",
    "queue_cancelled",
    "queue_escalated",
    "scan_mismatch",
    "scan_duplicate",
    "gate_scan_rejected",
    "department_handoff_failed",
    "operational_note_added",
    "scan_recorded",
  ]);
  if (alwaysSuppressTypes.has(event.eventType)) return true;

  return false;
}

export function curatedSafeDetail(fallback: string): string {
  if (textContainsSuppressedTerm(fallback)) return "Your order is progressing.";
  return fallback;
}
