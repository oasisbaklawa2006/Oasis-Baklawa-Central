import { assertStockAuthority, isForbiddenStockAction } from "@/lib/stock-authority/stockAuthorityGuard";
import { evaluateStockDeductionEligibility } from "./stockDeductionEligibility";
import { buildStockFinalizationEvent } from "./stockFinalizationEvents";
import { projectStockFinalization } from "./stockFinalizationProjection";
import {
  buildConsumptionMovementMetadata,
  movementTypeForConsumption,
} from "./stockMovementFinalization";
import { reconcileReservationsForConsumption } from "./stockReservationReconciliation";
import { requireReversalReason, buildReversalCompensatingMetadata } from "./stockReversal";
import { detectStockVariance } from "./stockVarianceDetection";
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

export interface StockFinalizationServiceDeps {
  balances: StockBalanceRepository;
  movements: StockMovementRepository;
  lineage: StockLineageRepository;
  events: StockFinalizationEventSink;
}

export function createStockFinalizationService(deps: StockFinalizationServiceDeps) {
  const { balances, movements, lineage, events } = deps;

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

      const reconciliation = reconcileReservationsForConsumption(
        input.reservations,
        input.alreadyFinalizedReservationIds ?? [],
      );
      if (reconciliation.blockers.length > 0) {
        throw new StockFinalizationError(
          "reconciliation_blocked",
          reconciliation.blockers.join(", "),
        );
      }

      const balanceMap = new Map<string, import("./stockFinalizationTypes").StockBalanceRecord>();
      for (const item of params.items) {
        let bal = await balances.getBalance(item.productId, item.sku, item.locationCode);
        if (!bal) {
          bal = await balances.upsertBalanceInitial({
            productId: item.productId,
            sku: item.sku,
            locationCode: item.locationCode,
            availableQty: item.consumeQty,
            reservedQty: item.consumeQty,
            damagedQty: 0,
            expiredQty: 0,
            quarantineQty: 0,
            version: 1,
          });
        }
        balanceMap.set(`${item.productId}:${item.sku}:${item.locationCode}`, bal);
      }

      const variances = detectStockVariance(reconciliation, balanceMap, input.locationCode);
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

      for (const item of params.items) {
        const reservation = input.reservations.find((r) => r.id === item.reservationId);
        const releaseReserved = reservation?.reservedQty ?? item.consumeQty;

        const result = await balances.applyConsumptionWithLock({
          productId: item.productId,
          sku: item.sku,
          locationCode: item.locationCode,
          consumeQty: item.consumeQty,
          releaseReservedQty: Math.min(releaseReserved, item.consumeQty),
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
      }

      await events.append(
        buildStockFinalizationEvent(
          "stock_consumption_finalized",
          params.orderId,
          "Stock consumption finalized",
          `Finalized ${finalized.length} reservation line(s) after dispatch_finalized`,
          ctx,
          { reservationIds: finalized, physicalDeduction: true },
        ),
      );

      return { finalizedReservationIds: finalized, projection: projectStockFinalization(input) };
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
        const result = await balances.applyReversalWithLock({
          productId: line.productId,
          sku: line.sku,
          locationCode: line.locationCode,
          restoreQty: line.consumedQty,
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
