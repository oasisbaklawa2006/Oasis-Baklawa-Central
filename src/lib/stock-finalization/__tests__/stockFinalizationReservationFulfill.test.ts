import { describe, expect, it } from "vitest";
import { createInMemoryReservationServiceBundle } from "@/lib/inventory-reservations/reservationService";
import { createStockFinalizationService } from "../stockFinalizationService";
import {
  createInMemoryStockBalanceRepository,
  createInMemoryStockFinalizationEventSink,
  createInMemoryStockLineageRepository,
  createInMemoryStockMovementRepository,
} from "../inMemoryStockFinalizationStore";
import type { StockFinalizationInput } from "../stockFinalizationTypes";
import type { StockReservationRecord } from "../stockReservationTypes";

const orderId = "00000000-0000-4000-8000-000000000602";
const productId = "00000000-0000-4000-8000-000000000702";
const reservationId = "00000000-0000-4000-8000-000000000802";

describe("stock finalization fulfills reservation (golden chain channel)", () => {
  it("sets reservation fulfilled after consumption for DISPATCH_MANAGER", async () => {
    const reservationBundle = createInMemoryReservationServiceBundle();
    const repository = reservationBundle.repository;

    const created = await repository.createReservation(
      {
        orderId,
        productId,
        sku: "OAS-PUR-1",
        requestedQty: 2,
        sourceDepartment: "golden_chain_operator",
      },
      {
        correlationId: "c-create",
        actorUserId: "dispatch-user",
        actorRole: "DISPATCH_MANAGER",
        actorDepartment: "golden_chain_operator",
        writeChannel: "golden_chain_operator",
      },
    );

    await repository.reserveInventory(
      {
        reservationId: created.reservation.id,
        expectedVersion: created.reservation.version,
        reserveQty: 2,
        reason: "uat",
      },
      {
        correlationId: "c-reserve",
        actorUserId: "dispatch-user",
        actorRole: "DISPATCH_MANAGER",
        actorDepartment: "golden_chain_operator",
        writeChannel: "golden_chain_operator",
      },
      {
        productId,
        sku: "OAS-PUR-1",
        physicalStock: 50,
        reservedOpen: 0,
        blockedInventory: 0,
        damagedInventory: 0,
        expiredInventory: 0,
        quarantineInventory: 0,
      },
    );

    const row = await repository.getReservation(created.reservation.id);
    if (!row) throw new Error("missing reservation");

    const reservation: StockReservationRecord = {
      id: row.id,
      reservationNumber: row.reservationNumber,
      orderId,
      productId,
      sku: "OAS-PUR-1",
      requestedQty: 2,
      reservedQty: 2,
      fulfilledQty: 0,
      releasedQty: 0,
      reservationStatus: "reserved",
    };

    const input: StockFinalizationInput = {
      orderId,
      orderStatus: "dispatched",
      dispatchReleaseStatus: "dispatch_finalized",
      reservations: [reservation],
      scanReference: "CTN-SCAN",
      gateReference: "GATE-SCAN",
      dispatchLineageId: "drl-602",
      locationCode: "WH-MAIN",
    };

    const balances = createInMemoryStockBalanceRepository([
      {
        id: "bal-oas",
        productId,
        sku: "OAS-PUR-1",
        locationCode: "WH-MAIN",
        availableQty: 40,
        reservedQty: 0,
        damagedQty: 0,
        expiredQty: 0,
        quarantineQty: 0,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    ]);

    const svc = createStockFinalizationService({
      balances,
      movements: createInMemoryStockMovementRepository(),
      lineage: createInMemoryStockLineageRepository(),
      events: createInMemoryStockFinalizationEventSink(),
      reservations: {
        fulfillAfterStockConsumption: async (fulfillInput, fulfillCtx) => {
          const latest = await repository.getReservation(fulfillInput.reservationId);
          if (!latest) throw new Error("missing");
          await repository.fulfillAfterStockConsumption(
            {
              reservationId: fulfillInput.reservationId,
              expectedVersion: latest.version,
              consumedQty: fulfillInput.consumedQty,
              reasonCode: fulfillInput.reasonCode,
            },
            {
              correlationId: fulfillCtx.correlationId,
              actorUserId: fulfillCtx.actorUserId,
              actorRole: fulfillCtx.actorRole,
              actorDepartment: "stock_finalization",
              writeChannel: fulfillCtx.reservationWriteChannel ?? "golden_chain_operator",
            },
          );
        },
      },
    });

    await svc.finalizeConsumption(
      input,
      {
        orderId,
        scanReference: "CTN-SCAN",
        gateReference: "GATE-SCAN",
        dispatchLineageId: "drl-602",
        items: [
          {
            reservationId: row.id,
            productId,
            sku: "OAS-PUR-1",
            locationCode: "WH-MAIN",
            consumeQty: 2,
            expectedBalanceVersion: 1,
          },
        ],
      },
      {
        correlationId: "corr-4g-602",
        actorUserId: "dispatch-user",
        actorRole: "DISPATCH_MANAGER",
        finalizeReason: "Golden chain operator",
        reservationWriteChannel: "golden_chain_operator",
      },
    );

    const after = await repository.getReservation(row.id);
    expect(after?.reservationStatus).toBe("fulfilled");
    expect(after?.fulfilledQty).toBe(2);
    expect(after?.reservedQty).toBe(0);
  });
});
