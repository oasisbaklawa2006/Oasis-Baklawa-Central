import { assertStockAuthority, isForbiddenStockAction } from "@/lib/stock-authority/stockAuthorityGuard";
import { evaluateStockDeductionEligibility } from "./stockDeductionEligibility";
import { buildStockFinalizationEvent } from "./stockFinalizationEvents";
import { syncReservationFulfillmentFromLineage } from "./syncReservationFulfillmentAfterConsumption";
import { projectStockFinalization } from "./stockFinalizationProjection";
import {
  buildConsumptionMovementMetadata,
  movementTypeForConsumption,
} from "./stockMovementFinalization";
import { reconcileReservationsForConsumption } from "./stockReservationReconciliation";
import { requireReversalReason, buildReversalCompensatingMetadata } from "./stockReversal";
import { detectStockVariance } from "./stockVarianceDetection";
import { validateConsumptionItemsAgainstReconciliation } from "./stockConsumptionValidation";
import type {
  FinalizeConsumptionParams,
  StockBalanceRepository,
  StockFinalizationInput,
  StockFinalizationOperationalEventRecord,
  StockFinalizationWriteContext,
  StockLineageRepository,
  StockMovementRepository,
} from "./stockFinalizationTypes";
import { StockFinalizationError } from "./stockFinalizationTypes";

export interface StockFinalizationEventSink {
  append(
    event: Omit<StockFinalizationOperationalEventRecord, "id" | "occurredAt">,
  ): Promise<StockFinalizationOperationalEventRecord>;
  listByOrder(orderId: string): Promise<StockFinalizationOperationalEventRecord[]>;
}

export interface StockReservationPostFinalizePort {
  fulfillAfterStockConsumption(
    input: { reservationId: string; consumedQty: number; reasonCode?: string },
    ctx: StockFinalizationWriteContext,
  ): Promise<void>;
}

export interface StockFinalizationServiceDeps {
  balances: StockBalanceRepository;
  movements: StockMovementRepository;
  lineage: StockLineageRepository;
  events: StockFinalizationEventSink;
  reservations?: StockReservationPostFinalizePort;
}

export type StockFinalizationService = ReturnType<typeof createStockFinalizationService>;

export function createStockFinalizationService(deps: StockFinalizationServiceDeps) {
  const { balances, movements, lineage, events, reservations } = deps;

  function guard(action: string, ctx: StockFinalizationWriteContext) {
    if (isForbiddenStockAction(action)) {
      throw new StockFinalizationError("forbidden_action", `Forbidden: ${action}`);
    }
    const auth = assertStockAuthority(action, {
      actorRole: ctx.actorRole,
      overrideReason: ctx.overrideReason,
      reversalReason: ctx.reversalReason,
      varianceReason: ctx.varianceReason,
    });
    if (!auth.allowed) throw new StockFinalizationError("authority_denied", auth.reason);
  }

  return {
    project(input: StockFinalizationInput) {
      return projectStockFinalization(input);
    },

    async listLineage(orderId: string) {
      return lineage.listByOrder(orderId);
    },

    async listMovements(orderId: string) {
      return movements.listByOrder(orderId);
    },

    async listEvents(orderId: string) {
      return events.listByOrder(orderId);
    },

    async finalizeConsumption(
      input: StockFinalizationInput,
      params: FinalizeConsumptionParams,
      ctx: StockFinalizationWriteContext,
    ) {
      guard("stock:finalize_consumption", ctx);

      const eligibility = evaluateStockDeductionEligibility(input);
      if (!eligibility.eligible) {
        throw new StockFinalizationError(
          "not_eligible",
          `Not eligible: ${eligibility.blockers.join(", ")}`,
        );
      }

      if (!ctx.finalizeReason?.trim()) {
        throw new StockFinalizationError(
          "reason_required",
          "Finalize consumption requires typed finalizeReason",
        );
      }

      const existingLineage = await lineage.listByOrder(params.orderId);
      const lineageFinalizedRows = existingLineage.filter(
        (row) => row.lineageType === "consumption_finalized",
      );
      const lineageFinalizedIds = new Set(lineageFinalizedRows.map((row) => row.reservationId));

      if (reservations && lineageFinalizedRows.length > 0) {
        await syncReservationFulfillmentFromLineage(
          input.reservations,
          lineageFinalizedRows,
          reservations,
          ctx,
        );
      }

      const itemsToConsume = params.items.filter((item) => !lineageFinalizedIds.has(item.reservationId));
      if (itemsToConsume.length === 0) {
        const finalizedReservationIds = [...lineageFinalizedIds];
        await events.append(
          buildStockFinalizationEvent(
            "stock_consumption_finalized",
            params.orderId,
            "Stock consumption already finalized",
            `Idempotent finalize: ${finalizedReservationIds.length} reservation line(s)`,
            ctx,
            { reservationIds: finalizedReservationIds, physicalDeduction: false, idempotent: true },
          ),
        );
        return {
          finalizedReservationIds,
          projection: projectStockFinalization({
            ...input,
            alreadyFinalizedReservationIds: finalizedReservationIds,
          }),
        };
      }

      const balanceMap = new Map<string, import("./stockFinalizationTypes").StockBalanceRecord>();
      for (const item of itemsToConsume) {
        const bal = await balances.getBalance(item.productId, item.sku, item.locationCode);
        if (!bal) {
          throw new StockFinalizationError(
            "balance_not_found",
            `No inventory_stock_balances row for ${item.sku} at ${item.locationCode}`,
          );
        }
        if (bal.version !== item.expectedBalanceVersion) {
          throw new StockFinalizationError(
            "stale_version",
            `Balance version mismatch for ${item.sku} before consumption`,
          );
        }
        balanceMap.set(`${item.productId}:${item.sku}:${item.locationCode}`, bal);
      }

      const alreadyFinalizedIds = [
        ...(input.alreadyFinalizedReservationIds ?? []),
        ...lineageFinalizedIds,
      ];
      const reconciliationForConsume = reconcileReservationsForConsumption(
        input.reservations,
        alreadyFinalizedIds,
      );
      if (reconciliationForConsume.reconciliationStatus === "variance") {
        throw new StockFinalizationError(
          "reconciliation_blocked",
          `Reservation reconciliation variance (${reconciliationForConsume.varianceQty} unresolved qty); resolve before finalizing consumption`,
        );
      }
      if (reconciliationForConsume.blockers.length > 0) {
        throw new StockFinalizationError(
          "reconciliation_blocked",
          reconciliationForConsume.blockers.join(", "),
        );
      }

      validateConsumptionItemsAgainstReconciliation(itemsToConsume, reconciliationForConsume);

      const variances = detectStockVariance(reconciliationForConsume, balanceMap, input.locationCode);
      if (variances.some((v) => v.code === "insufficient_available")) {
        await events.append(
          buildStockFinalizationEvent(
            "stock_variance_detected",
            params.orderId,
            "Stock variance detected",
            variances.map((v) => v.message).join("; "),
            ctx,
            { variances },
          ),
        );
        throw new StockFinalizationError("negative_stock", "Insufficient available quantity");
      }

      const finalized: string[] = [];

      for (const item of itemsToConsume) {
        const reservation = input.reservations.find((r) => r.id === item.reservationId);
        const bal = balanceMap.get(`${item.productId}:${item.sku}:${item.locationCode}`);
        const releaseReserved = Math.min(
          reservation?.reservedQty ?? item.consumeQty,
          item.consumeQty,
          bal?.reservedQty ?? 0,
        );

        const result = await balances.applyConsumptionWithLock({
          productId: item.productId,
          sku: item.sku,
          locationCode: item.locationCode,
          consumeQty: item.consumeQty,
          releaseReservedQty: releaseReserved,
          expectedVersion: item.expectedBalanceVersion,
        });

        if (!result.updated || !result.balance) {
          throw new StockFinalizationError("stale_version", `Stale balance version for ${item.sku}`);
        }

        const mov = await movements.appendMovement({
          movementType: movementTypeForConsumption("finalize"),
          reservationId: item.reservationId,
          productId: item.productId,
          sku: item.sku,
          quantity: item.consumeQty,
          sourceLocation: item.locationCode,
          destinationLocation: null,
          actorId: ctx.actorUserId,
          reasonCode: ctx.finalizeReason ?? "dispatch_consumption",
          correlationId: ctx.correlationId,
          metadata: buildConsumptionMovementMetadata({
            orderId: params.orderId,
            reservationId: item.reservationId,
            scanReference: params.scanReference,
            gateReference: params.gateReference,
            dispatchLineageId: params.dispatchLineageId,
            physicalDeduction: true,
          }),
        });

        await lineage.insertLineage({
          orderId: params.orderId,
          reservationId: item.reservationId,
          productId: item.productId,
          sku: item.sku,
          locationCode: item.locationCode,
          consumedQty: item.consumeQty,
          movementId: mov.id,
          lineageType: "consumption_finalized",
          scanReference: params.scanReference,
          gateReference: params.gateReference,
          dispatchLineageId: params.dispatchLineageId,
          actorId: ctx.actorUserId,
          actorRole: ctx.actorRole,
          reasonCode: ctx.finalizeReason ?? null,
          correlationId: ctx.correlationId,
          metadata: { balanceVersion: result.balance.version },
        });

        finalized.push(item.reservationId);

        if (reservations) {
          await reservations.fulfillAfterStockConsumption(
            {
              reservationId: item.reservationId,
              consumedQty: item.consumeQty,
              reasonCode: ctx.finalizeReason ?? "stock_consumption_finalized",
            },
            ctx,
          );
        }
      }

      const allFinalizedIds = [...new Set([...lineageFinalizedIds, ...finalized])];

      await events.append(
        buildStockFinalizationEvent(
          "stock_consumption_finalized",
          params.orderId,
          "Stock consumption finalized",
          `Finalized ${finalized.length} reservation line(s) after dispatch_finalized`,
          ctx,
          { reservationIds: allFinalizedIds, physicalDeduction: finalized.length > 0 },
        ),
      );

      return {
        finalizedReservationIds: allFinalizedIds,
        projection: projectStockFinalization({
          ...input,
          alreadyFinalizedReservationIds: allFinalizedIds,
        }),
      };
    },

    async reverseConsumption(
      input: StockFinalizationInput,
      orderId: string,
      lineages: { reservationId: string; productId: string; sku: string; locationCode: string; consumedQty: number; movementId: string | null; balanceVersion: number }[],
      ctx: StockFinalizationWriteContext,
    ) {
      guard("stock:reverse_consumption", ctx);
      requireReversalReason(ctx);

      const eligibility = evaluateStockDeductionEligibility(input);
      if (!eligibility.eligible && input.orderStatus !== "dispatched") {
        throw new StockFinalizationError("not_eligible", "Reversal requires prior governed consumption context");
      }

      for (const line of lineages) {
        const reservation = input.reservations.find((r) => r.id === line.reservationId);
        const restoreReserved = reservation
          ? Math.min(reservation.reservedQty, line.consumedQty)
          : line.consumedQty;
        const result = await balances.applyReversalWithLock({
          productId: line.productId,
          sku: line.sku,
          locationCode: line.locationCode,
          restoreQty: line.consumedQty,
          restoreReservedQty: restoreReserved,
          expectedVersion: line.balanceVersion,
        });
        if (!result.updated) {
          throw new StockFinalizationError("stale_version", `Stale balance on reversal for ${line.sku}`);
        }

        await movements.appendMovement({
          movementType: movementTypeForConsumption("reverse"),
          reservationId: line.reservationId,
          productId: line.productId,
          sku: line.sku,
          quantity: line.consumedQty,
          sourceLocation: null,
          destinationLocation: line.locationCode,
          actorId: ctx.actorUserId,
          reasonCode: ctx.reversalReason ?? null,
          correlationId: ctx.correlationId,
          metadata: buildReversalCompensatingMetadata({
            orderId,
            originalMovementId: line.movementId,
            restoreQty: line.consumedQty,
            reason: ctx.reversalReason!,
          }),
        });

        await lineage.insertLineage({
          orderId,
          reservationId: line.reservationId,
          productId: line.productId,
          sku: line.sku,
          locationCode: line.locationCode,
          consumedQty: line.consumedQty,
          movementId: line.movementId,
          lineageType: "consumption_reversed",
          scanReference: input.scanReference,
          gateReference: input.gateReference,
          dispatchLineageId: input.dispatchLineageId,
          actorId: ctx.actorUserId,
          actorRole: ctx.actorRole,
          reasonCode: ctx.reversalReason ?? null,
          correlationId: ctx.correlationId,
          metadata: { compensating: true },
        });
      }

      await events.append(
        buildStockFinalizationEvent(
          "stock_consumption_reversed",
          orderId,
          "Stock consumption reversed",
          ctx.reversalReason!,
          ctx,
          { compensating: true },
        ),
      );
    },

    async recordVariance(orderId: string, quantity: number, ctx: StockFinalizationWriteContext) {
      guard("stock:record_variance", ctx);
      if (!ctx.varianceReason?.trim()) {
        throw new StockFinalizationError("reason_required", "Variance recording requires varianceReason");
      }
      await events.append(
        buildStockFinalizationEvent(
          "stock_variance_recorded",
          orderId,
          "Stock variance recorded",
          ctx.varianceReason,
          ctx,
          { quantity },
        ),
      );
    },
  };
}
