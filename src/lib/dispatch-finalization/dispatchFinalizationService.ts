import {
  assertDispatchFinalizationAuthority,
  isForbiddenFinalizationAction,
} from "@/lib/dispatch-finalization-authority/dispatchFinalizationAuthorityGuard";
import { buildFinalizationOperationalEvent } from "./dispatchFinalizationEventBridge";
import { projectDispatchRelease } from "./dispatchFinalizationProjection";
import { executeGovernedFinalizeDispatch } from "./dispatchFinalizationWorkflow";
import { buildReversalLineageRow } from "./dispatchLineage";
import { projectCustomerPublicationPreview } from "./dispatchPublication";
import { assertReversalAllowed, deriveReversalTargetStatus, requireReversalReason } from "./dispatchReversal";
import {
  buildStockConfirmationMetadata,
  stockConfirmationEventType,
  type StockConfirmationIntent,
} from "./dispatchStockConfirmation";
import type {
  DispatchFinalizationInput,
  DispatchFinalizationOperationalEventRecord,
  DispatchFinalizationWriteContext,
  DispatchLineageStore,
  OrderDispatchStatusRepository,
} from "./dispatchFinalizationTypes";
import { DispatchFinalizationError } from "./dispatchFinalizationTypes";

export interface DispatchFinalizationEventSink {
  append(event: DispatchFinalizationOperationalEventRecord): Promise<DispatchFinalizationOperationalEventRecord>;
  listByOrder(orderId: string): Promise<DispatchFinalizationOperationalEventRecord[]>;
}

export function createInMemoryDispatchFinalizationEventSink(): DispatchFinalizationEventSink {
  const events: DispatchFinalizationOperationalEventRecord[] = [];
  return {
    async append(event) {
      events.push(event);
      return event;
    },
    async listByOrder(orderId) {
      return events.filter((e) => e.orderId === orderId);
    },
  };
}

export interface DispatchFinalizationServiceDeps {
  lineage: DispatchLineageStore;
  orders: OrderDispatchStatusRepository;
  events: DispatchFinalizationEventSink;
}

export function createDispatchFinalizationService(deps: DispatchFinalizationServiceDeps) {
  const { lineage, orders, events } = deps;

  function guard(action: string, ctx: DispatchFinalizationWriteContext) {
    if (isForbiddenFinalizationAction(action)) {
      throw new DispatchFinalizationError("forbidden_action", `Forbidden: ${action}`);
    }
    const auth = assertDispatchFinalizationAuthority(action, {
      actorRole: ctx.actorRole,
      overrideReason: ctx.overrideReason,
      reversalReason: ctx.reversalReason,
    });
    if (!auth.allowed) throw new DispatchFinalizationError("authority_denied", auth.reason);
  }

  return {
    projectRelease(input: DispatchFinalizationInput) {
      return projectDispatchRelease(input);
    },

    previewCustomerPublication(orderId: string, transporterLabel?: string) {
      return projectCustomerPublicationPreview(orderId, new Date().toISOString(), transporterLabel);
    },

    async listLineage(orderId: string) {
      return lineage.listByOrder(orderId);
    },

    async listEvents(orderId: string) {
      return events.listByOrder(orderId);
    },

    async recordTransportHandoff(
      input: DispatchFinalizationInput,
      ctx: DispatchFinalizationWriteContext,
    ): Promise<{ eventId: string }> {
      guard("dispatch:finalize", ctx);
      const evt = await events.append(
        buildFinalizationOperationalEvent(
          "dispatch_transport_handoff_finalized",
          input.orderId,
          ctx,
          "Transporter handoff finalized",
          input.transporterReference ?? "reference recorded",
          "customer_safe",
        ),
      );
      await lineage.insertLineage({
        orderId: input.orderId,
        previousStatus: input.currentOrderStatus,
        nextStatus: input.currentOrderStatus,
        releaseReason: "Transport handoff",
        releaseType: "transport_handoff",
        transporterReference: input.transporterReference,
        gateReference: input.gateReference,
        completionReference: input.completionReference,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: ctx.overrideReason ?? null,
        correlationId: ctx.correlationId,
        metadata: {},
      });
      return { eventId: evt.id };
    },

    async finalizeDispatch(
      input: DispatchFinalizationInput,
      ctx: DispatchFinalizationWriteContext,
      options?: { trackingNumber?: string | null; courierName?: string | null },
    ) {
      guard("dispatch:finalize", ctx);
      const result = await executeGovernedFinalizeDispatch({
        lineage,
        orders,
        finalize: { input, ctx, ...options },
      });

      await events.append(
        buildFinalizationOperationalEvent(
          "dispatch_finalized",
          input.orderId,
          ctx,
          "Dispatch finalized (governed)",
          `${result.statusUpdate.previousStatus} → ${result.statusUpdate.nextStatus}`,
          "customer_safe",
        ),
      );

      return result;
    },

    async publishCustomerRelease(
      orderId: string,
      ctx: DispatchFinalizationWriteContext,
      transporterLabel?: string,
    ) {
      guard("dispatch:publish_customer_release", ctx);
      const live = await orders.getOrderStatus(orderId);
      const status = live?.status?.toLowerCase() ?? "";
      if (status !== "dispatched" && status !== "in_transit") {
        throw new DispatchFinalizationError(
          "not_eligible",
          "Customer publication requires dispatch_finalized order status",
        );
      }

      await lineage.insertLineage({
        orderId,
        previousStatus: live?.status ?? "dispatched",
        nextStatus: live?.status ?? "dispatched",
        releaseReason: "Customer-safe publication",
        releaseType: "customer_publication",
        transporterReference: transporterLabel ?? null,
        gateReference: null,
        completionReference: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: ctx.overrideReason ?? null,
        correlationId: ctx.correlationId,
        metadata: { customerSafe: true },
      });

      const preview = projectCustomerPublicationPreview(orderId, new Date().toISOString(), transporterLabel);
      const evt = await events.append(
        buildFinalizationOperationalEvent(
          "dispatch_customer_release_published",
          orderId,
          ctx,
          "Customer release published",
          "Dispatched / In transit visible — no notification sent",
          "customer_safe",
        ),
      );
      return { eventId: evt.id, preview };
    },

    async requestDispatchReversal(orderId: string, ctx: DispatchFinalizationWriteContext) {
      guard("dispatch:reverse_release", ctx);
      const reason = requireReversalReason(ctx.reversalReason);
      const live = await orders.getOrderStatus(orderId);
      if (!live) throw new DispatchFinalizationError("validation_failed", "Order not found");
      assertReversalAllowed(live.status);

      const evt = await events.append(
        buildFinalizationOperationalEvent(
          "dispatch_reversal_requested",
          orderId,
          ctx,
          "Dispatch reversal requested",
          reason,
        ),
      );
      return { eventId: evt.id };
    },

    async completeDispatchReversal(orderId: string, ctx: DispatchFinalizationWriteContext) {
      guard("dispatch:reverse_release", ctx);
      const reason = requireReversalReason(ctx.reversalReason);
      const live = await orders.getOrderStatus(orderId);
      if (!live) throw new DispatchFinalizationError("validation_failed", "Order not found");
      assertReversalAllowed(live.status);

      const nextStatus = deriveReversalTargetStatus(live.status);
      const row = buildReversalLineageRow({
        orderId,
        previousStatus: live.status,
        nextStatus,
        reversalReason: reason,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        correlationId: ctx.correlationId,
        overrideReason: ctx.overrideReason ?? null,
      });
      await lineage.insertLineage(row);

      // Reversal: compensating lineage + events only — no order.status regression in Phase 4E.

      const evt = await events.append(
        buildFinalizationOperationalEvent(
          "dispatch_reversal_completed",
          orderId,
          ctx,
          "Dispatch reversal completed",
          "Compensating lineage — customer-safe reversal suppressed",
        ),
      );
      return { eventId: evt.id, nextStatus };
    },

    async confirmStockConsumptionIntent(
      orderId: string,
      intent: StockConfirmationIntent,
      note: string,
      ctx: DispatchFinalizationWriteContext,
    ) {
      guard("dispatch:confirm_stock_consumption", ctx);
      await lineage.insertLineage({
        orderId,
        previousStatus: "dispatched",
        nextStatus: "dispatched",
        releaseReason: note,
        releaseType: intent === "confirmed" ? "stock_confirmation" : "stock_reversal",
        transporterReference: null,
        gateReference: null,
        completionReference: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: null,
        correlationId: ctx.correlationId,
        metadata: buildStockConfirmationMetadata(orderId, intent, note),
      });
      const evt = await events.append(
        buildFinalizationOperationalEvent(
          stockConfirmationEventType(intent),
          orderId,
          ctx,
          intent === "confirmed" ? "Stock consumption intent confirmed" : "Stock consumption intent reversed",
          "Operational intent only — no stock table mutation",
        ),
      );
      return { eventId: evt.id };
    },
  };
}

export type DispatchFinalizationService = ReturnType<typeof createDispatchFinalizationService>;
