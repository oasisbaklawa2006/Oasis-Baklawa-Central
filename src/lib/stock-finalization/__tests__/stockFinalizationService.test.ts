import { describe, expect, it } from "vitest";
import { createStockFinalizationService } from "../stockFinalizationService";
import {
  createInMemoryStockBalanceRepository,
  createInMemoryStockFinalizationEventSink,
  createInMemoryStockLineageRepository,
  createInMemoryStockMovementRepository,
} from "../inMemoryStockFinalizationStore";
import { StockFinalizationError } from "../stockFinalizationTypes";
import type { StockFinalizationInput } from "../stockFinalizationTypes";
import type { StockReservationRecord } from "../stockReservationTypes";

const orderId = "00000000-0000-4000-8000-000000000601";
const productId = "00000000-0000-4000-8000-000000000701";
const reservationId = "00000000-0000-4000-8000-000000000801";

const reservation: StockReservationRecord = {
  id: reservationId,
  reservationNumber: "RSV-601",
  orderId,
  productId,
  sku: "BAK-601",
  requestedQty: 5,
  reservedQty: 5,
  fulfilledQty: 0,
  releasedQty: 0,
  reservationStatus: "reserved",
};

const finalizedInput: StockFinalizationInput = {
  orderId,
  orderStatus: "dispatched",
  dispatchReleaseStatus: "dispatch_finalized",
  reservations: [reservation],
  scanReference: "PACK-SCAN-601",
  gateReference: "GATE-601",
  dispatchLineageId: "drl-601",
  locationCode: "WH-MAIN",
};

const ctx = {
  correlationId: "corr-4g-svc",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "INVENTORY_MANAGER",
  finalizeReason: "Post-dispatch consumption",
};

function service() {
  return createStockFinalizationService({
    balances: createInMemoryStockBalanceRepository([
      {
        id: "bal-1",
        productId,
        sku: "BAK-601",
        locationCode: "WH-MAIN",
        availableQty: 20,
        reservedQty: 5,
        damagedQty: 0,
        expiredQty: 0,
        quarantineQty: 0,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    ]),
    movements: createInMemoryStockMovementRepository(),
    lineage: createInMemoryStockLineageRepository(),
    events: createInMemoryStockFinalizationEventSink(),
  });
}

describe("stockFinalizationService", () => {
  it("denies finalize before dispatch_finalized", async () => {
    const svc = service();
    await expect(
      svc.finalizeConsumption(
        { ...finalizedInput, dispatchReleaseStatus: "dispatch_release_ready", orderStatus: "packed_ready" },
        {
          orderId,
          scanReference: "PACK-SCAN-601",
          gateReference: "GATE-601",
          dispatchLineageId: "drl-601",
          items: [
            {
              reservationId,
              productId,
              sku: "BAK-601",
              locationCode: "WH-MAIN",
              consumeQty: 5,
              expectedBalanceVersion: 1,
            },
          ],
        },
        ctx,
      ),
    ).rejects.toThrow(StockFinalizationError);
  });

  it("finalizes consumption with ledger and lineage", async () => {
    const svc = service();
    const result = await svc.finalizeConsumption(
      finalizedInput,
      {
        orderId,
        scanReference: "PACK-SCAN-601",
        gateReference: "GATE-601",
        dispatchLineageId: "drl-601",
        items: [
          {
            reservationId,
            productId,
            sku: "BAK-601",
            locationCode: "WH-MAIN",
            consumeQty: 5,
            expectedBalanceVersion: 1,
          },
        ],
      },
      ctx,
    );
    expect(result.finalizedReservationIds).toContain(reservationId);
    const lineage = await svc.listLineage(orderId);
    expect(lineage.some((l) => l.lineageType === "consumption_finalized")).toBe(true);
    const evts = await svc.listEvents(orderId);
    expect(evts.every((e) => e.visibility === "internal")).toBe(true);
    expect(evts.some((e) => e.eventType === "stock_consumption_finalized")).toBe(true);
  });

  it("rejects stale balance version", async () => {
    const svc = service();
    await expect(
      svc.finalizeConsumption(
        finalizedInput,
        {
          orderId,
          scanReference: "PACK-SCAN-601",
          gateReference: null,
          dispatchLineageId: null,
          items: [
            {
              reservationId,
              productId,
              sku: "BAK-601",
              locationCode: "WH-MAIN",
              consumeQty: 5,
              expectedBalanceVersion: 99,
            },
          ],
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "stale_version" });
  });

  it("reversal requires typed reason", async () => {
    const svc = service();
    await svc.finalizeConsumption(
      finalizedInput,
      {
        orderId,
        scanReference: "PACK-SCAN-601",
        gateReference: "GATE-601",
        dispatchLineageId: "drl-601",
        items: [
          {
            reservationId,
            productId,
            sku: "BAK-601",
            locationCode: "WH-MAIN",
            consumeQty: 5,
            expectedBalanceVersion: 1,
          },
        ],
      },
      ctx,
    );
    await expect(
      svc.reverseConsumption(finalizedInput, orderId, [], { ...ctx, reversalReason: null }),
    ).rejects.toThrow(StockFinalizationError);
  });

  it("denies finance role", async () => {
    const svc = service();
    await expect(
      svc.finalizeConsumption(
        finalizedInput,
        {
          orderId,
          scanReference: "PACK-SCAN-601",
          gateReference: "GATE-601",
          dispatchLineageId: null,
          items: [
            {
              reservationId,
              productId,
              sku: "BAK-601",
              locationCode: "WH-MAIN",
              consumeQty: 5,
              expectedBalanceVersion: 1,
            },
          ],
        },
        { ...ctx, actorRole: "FINANCE_HEAD" },
      ),
    ).rejects.toThrow(StockFinalizationError);
  });
});
