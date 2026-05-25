import type { DispatchReleaseLineageRecord, DispatchReleaseType } from "./dispatchFinalizationTypes";

export function validateLineageInsert(
  row: Pick<
    DispatchReleaseLineageRecord,
    "orderId" | "previousStatus" | "nextStatus" | "releaseType" | "correlationId"
  >,
): void {
  if (!row.orderId?.trim()) throw new Error("dispatch_release_lineage requires order_id");
  if (!row.correlationId?.trim()) throw new Error("dispatch_release_lineage requires correlation_id");
  if (!row.previousStatus?.trim() || !row.nextStatus?.trim()) {
    throw new Error("dispatch_release_lineage requires previous_status and next_status");
  }
}

export function buildFinalizeLineageRow(params: {
  orderId: string;
  previousStatus: string;
  releaseReason: string;
  transporterReference: string | null;
  gateReference: string | null;
  completionReference: string | null;
  actorId: string;
  actorRole: string;
  actorDepartment: string | null;
  overrideReason: string | null;
  correlationId: string;
}): Omit<DispatchReleaseLineageRecord, "id" | "createdAt"> {
  return {
    orderId: params.orderId,
    previousStatus: params.previousStatus,
    nextStatus: "dispatched",
    releaseReason: params.releaseReason,
    releaseType: "finalize",
    transporterReference: params.transporterReference,
    gateReference: params.gateReference,
    completionReference: params.completionReference,
    actorId: params.actorId,
    actorRole: params.actorRole,
    actorDepartment: params.actorDepartment,
    overrideReason: params.overrideReason,
    correlationId: params.correlationId,
    metadata: { governed: true },
  };
}

export function buildReversalLineageRow(params: {
  orderId: string;
  previousStatus: string;
  nextStatus: string;
  reversalReason: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  overrideReason: string | null;
}): Omit<DispatchReleaseLineageRecord, "id" | "createdAt"> {
  return {
    orderId: params.orderId,
    previousStatus: params.previousStatus,
    nextStatus: params.nextStatus,
    releaseReason: params.reversalReason,
    releaseType: "reversal",
    transporterReference: null,
    gateReference: null,
    completionReference: null,
    actorId: params.actorId,
    actorRole: params.actorRole,
    actorDepartment: null,
    overrideReason: params.overrideReason,
    correlationId: params.correlationId,
    metadata: { compensating: true },
  };
}

export function lineageReleaseTypeLabel(type: DispatchReleaseType): string {
  return type.replace(/_/g, " ");
}
