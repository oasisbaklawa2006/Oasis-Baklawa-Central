import type { WriteActionKind } from "./writeActionKinds";
import { WRITE_AUTHORITY } from "./writeAuthorityMatrix";
import { rollbackPathForWriteAction } from "./writeRollback";
import { isWriteFeatureEnabled } from "./writeFeatureGate";

export interface WritePreflightResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  auditRequired: boolean;
  idempotencyRequired: boolean;
  rollbackPath: string;
}

function emptyResult(kind: WriteActionKind): Pick<WritePreflightResult, "auditRequired" | "idempotencyRequired" | "rollbackPath"> {
  const a = WRITE_AUTHORITY[kind];
  return {
    auditRequired: a.requiresAudit,
    idempotencyRequired: a.requiresIdempotencyKey,
    rollbackPath: rollbackPathForWriteAction(kind),
  };
}

function finalize(
  kind: WriteActionKind,
  partial: Pick<WritePreflightResult, "blockers" | "warnings">,
): WritePreflightResult {
  const base = emptyResult(kind);
  return {
    ...base,
    ...partial,
    allowed: partial.blockers.length === 0,
  };
}

export function validateReservationDraftWrite(input: {
  storeId: string;
  customerName: string;
  phone: string;
  product: string;
  qtyDisplay: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "retail.reservation_draft.create";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_RETAIL_RESERVATION_WRITES is false — persistence disabled.");
  if (!input.storeId.trim()) blockers.push("storeId is required.");
  if (!input.customerName.trim()) blockers.push("customerName is required.");
  if (!input.phone.trim()) blockers.push("phone is required.");
  if (!input.product.trim()) blockers.push("product is required.");
  if (!input.qtyDisplay.trim()) blockers.push("qtyDisplay is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required for idempotency scope.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required for stable idempotency.");
  warnings.push("Stock is not reserved by this draft — manual verification still required after persistence ships.");
  return finalize(kind, { blockers, warnings });
}

export function validateFactoryFollowupWrite(input: {
  storeId: string;
  product: string;
  qtyDisplay: string;
  neededByDisplay: string;
  department: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "retail.factory_followup.create";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_FACTORY_FOLLOWUP_WRITES is false — persistence disabled.");
  if (!input.storeId.trim()) blockers.push("storeId is required.");
  if (!input.product.trim()) blockers.push("product is required.");
  if (!input.qtyDisplay.trim()) blockers.push("qtyDisplay is required.");
  if (!input.neededByDisplay.trim()) blockers.push("neededByDisplay is required.");
  if (!input.department.trim()) blockers.push("department is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required for idempotency scope.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required for stable idempotency.");
  warnings.push("Factory follow-up does not auto-notify WhatsApp — operator action stays separate.");
  return finalize(kind, { blockers, warnings });
}

export function validateMediaMetadataWrite(input: {
  entityId: string;
  mediaKind: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "media.attachment_metadata.create";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_MEDIA_METADATA_WRITES is false — persistence disabled.");
  if (!input.entityId.trim()) blockers.push("entityId is required.");
  if (!input.mediaKind.trim()) blockers.push("mediaKind is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required.");
  warnings.push("Binary upload pipeline is not activated in this build.");
  return finalize(kind, { blockers, warnings });
}

export function validateNotificationAcknowledgeWrite(input: {
  notificationId: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "notification.acknowledge";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_NOTIFICATION_ACK_WRITES is false — persistence disabled.");
  if (!input.notificationId.trim()) blockers.push("notificationId is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required.");
  return finalize(kind, { blockers, warnings });
}

export function validateInventoryHoldRequest(input: {
  skuOrRef: string;
  qtyIntentDisplay: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "inventory.reservation_hold.request";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_INVENTORY_HOLD_WRITES is false — persistence disabled.");
  if (!input.skuOrRef.trim()) blockers.push("skuOrRef is required.");
  if (!input.qtyIntentDisplay.trim()) blockers.push("qtyIntentDisplay is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required.");
  warnings.push("Hold request does not mutate stock in this foundation — ledger activation is separate.");
  return finalize(kind, { blockers, warnings });
}

export function validateInventoryReconciliationNoteWrite(input: {
  skuOrRef: string;
  noteBody: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "inventory.reconciliation_note.create";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_INVENTORY_HOLD_WRITES is false — persistence disabled.");
  if (!input.skuOrRef.trim()) blockers.push("skuOrRef is required.");
  if (!input.noteBody.trim()) blockers.push("noteBody is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required.");
  warnings.push("Reconciliation note does not post ledger movements in this foundation.");
  return finalize(kind, { blockers, warnings });
}

export function validateApprovalRequestWrite(input: {
  subject: string;
  route: string;
  actorId: string;
  correlationId: string;
}): WritePreflightResult {
  const kind: WriteActionKind = "approval.request.create";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isWriteFeatureEnabled(kind)) blockers.push("Feature flag ENABLE_APPROVAL_REQUEST_WRITES is false — persistence disabled.");
  if (!input.subject.trim()) blockers.push("subject is required.");
  if (!input.route.trim()) blockers.push("route is required.");
  if (!input.actorId.trim()) blockers.push("actorId is required.");
  if (!input.correlationId.trim()) blockers.push("correlationId is required.");
  return finalize(kind, { blockers, warnings });
}
