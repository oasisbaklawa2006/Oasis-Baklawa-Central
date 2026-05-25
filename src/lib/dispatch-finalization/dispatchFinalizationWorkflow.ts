import { buildFinalizeLineageRow } from "./dispatchLineage";
import { projectDispatchRelease } from "./dispatchFinalizationProjection";
import { requireTransporterReference } from "./dispatchTransportFinalization";
import { updateOrderDispatchStatus } from "./dispatchStatusMutation";
import type {
  DispatchFinalizationInput,
  DispatchFinalizationWriteContext,
  DispatchLineageStore,
  OrderDispatchStatusRepository,
} from "./dispatchFinalizationTypes";
import { DispatchFinalizationError } from "./dispatchFinalizationTypes";

export interface FinalizeDispatchParams {
  input: DispatchFinalizationInput;
  ctx: DispatchFinalizationWriteContext;
  trackingNumber?: string | null;
  courierName?: string | null;
}

export interface FinalizeDispatchResult {
  projection: ReturnType<typeof projectDispatchRelease>;
  lineageId: string;
  statusUpdate: { previousStatus: string; nextStatus: string };
}

export async function executeGovernedFinalizeDispatch(params: {
  lineage: DispatchLineageStore;
  orders: OrderDispatchStatusRepository;
  finalize: FinalizeDispatchParams;
}): Promise<FinalizeDispatchResult> {
  const { input, ctx } = params.finalize;
  const projection = projectDispatchRelease(input);

  if (!projection.canFinalize) {
    throw new DispatchFinalizationError(
      "not_eligible",
      `Not eligible for finalize: ${projection.releaseStatus}`,
    );
  }

  const reason = ctx.finalizeReason?.trim();
  if (!reason) {
    throw new DispatchFinalizationError("reason_required", "Finalize requires finalizeReason");
  }

  const transporterRef = requireTransporterReference(input.transporterReference);
  const live = await params.orders.getOrderStatus(input.orderId);
  const previousStatus = live?.status ?? input.currentOrderStatus;

  const lineageRow = buildFinalizeLineageRow({
    orderId: input.orderId,
    previousStatus,
    releaseReason: reason,
    transporterReference: transporterRef,
    gateReference: input.gateReference,
    completionReference: input.completionReference,
    actorId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    actorDepartment: ctx.actorDepartment ?? null,
    overrideReason: ctx.overrideReason ?? null,
    correlationId: ctx.correlationId,
  });

  const lineage = await params.lineage.insertLineage(lineageRow);

  const statusUpdate = await updateOrderDispatchStatus(params.orders, {
    orderId: input.orderId,
    expectedPreviousStatus: previousStatus,
    nextStatus: "dispatched",
    trackingNumber: params.finalize.trackingNumber,
    courierName: params.finalize.courierName,
  });

  await params.orders.insertStatusHistory({
    orderId: input.orderId,
    oldStatus: statusUpdate.previousStatus,
    newStatus: statusUpdate.nextStatus,
    actorId: ctx.actorUserId,
  });

  return {
    projection: {
      ...projection,
      releaseStatus: "dispatch_finalized",
      canFinalize: false,
      canPublishCustomerRelease: true,
    },
    lineageId: lineage.id,
    statusUpdate: {
      previousStatus: statusUpdate.previousStatus,
      nextStatus: statusUpdate.nextStatus,
    },
  };
}
