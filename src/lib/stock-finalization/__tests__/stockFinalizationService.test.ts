import { describe, expect, it } from "vitest";
import { projectStockFinalization } from "../stockFinalizationProjection";
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

function service(initialBalanceVersion = 1) {
  const balances = createInMemoryStockBalanceRepository([
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
      version: initialBalanceVersion,
      updatedAt: new Date().toISOString(),
    },
  ]);
  return {
    svc: createStockFinalizationService({
      balances,
      movements: createInMemoryStockMovementRepository(),
      lineage: createInMemoryStockLineageRepository(),
      events: createInMemoryStockFinalizationEventSink(),
    }),
    balances,
  };
}

const varianceReservation: StockReservationRecord = {
  ...reservation,
  requestedQty: 10,
  reservedQty: 5,
};

const varianceInput: StockFinalizationInput = {
  ...finalizedInput,
  reservations: [varianceReservation],
};

const finalizeParams = {
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
};

describe("stockFinalizationService", () => {
  it("blocks finalize when reconciliation_status is variance without writes", async () => {
    const { svc, balances } = service();
    await expect(svc.finalizeConsumption(varianceInput, finalizeParams, ctx)).rejects.toMatchObject({
      code: "reconciliation_blocked",
    });

    const bal = await balances.getBalance(productId, "BAK-601", "WH-MAIN");
    expect(bal?.version).toBe(1);
    expect(bal?.availableQty).toBe(20);

    const lineage = await svc.listLineage(orderId);
    expect(lineage).toHaveLength(0);

    const movements = await svc.listMovements(orderId);
    expect(movements).toHaveLength(0);

    const evts = await svc.listEvents(orderId);
    expect(evts.some((e) => e.eventType === "stock_consumption_finalized")).toBe(false);
  });

  it("allows finalize when reconciliation_status is aligned", async () => {
    const { svc } = service();
    const projection = projectStockFinalization(finalizedInput);
    expect(projection.reconciliationStatus).toBe("aligned");
    expect(projection.canFinalizeConsumption).toBe(true);

    const result = await svc.finalizeConsumption(finalizedInput, finalizeParams, ctx);
    expect(result.finalizedReservationIds).toContain(reservationId);
  });

  it("denies SUPER_ADMIN finalize without overrideReason", async () => {
    const { svc } = service();
    await expect(
      svc.finalizeConsumption(finalizedInput, finalizeParams, {
        ...ctx,
        actorRole: "SUPER_ADMIN",
      }),
    ).rejects.toMatchObject({
      code: "authority_denied",
    });
  });

  it("allows SUPER_ADMIN finalize with typed overrideReason", async () => {
    const { svc } = service();
    const result = await svc.finalizeConsumption(finalizedInput, finalizeParams, {
      ...ctx,
      actorRole: "SUPER_ADMIN",
      overrideReason: "Governed SUPER_ADMIN override",
    });
    expect(result.finalizedReservationIds).toContain(reservationId);
  });

  it("consumes when balance reserved_qty is zero but reservation row holds qty", async () => {
    const balances = createInMemoryStockBalanceRepository([
      {
        id: "bal-unsynced",
        productId,
        sku: "BAK-601",
        locationCode: "WH-MAIN",
        availableQty: 50,
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
    });
    await svc.finalizeConsumption(finalizedInput, finalizeParams, ctx);
    const bal = await balances.getBalance(productId, "BAK-601", "WH-MAIN");
    expect(bal?.availableQty).toBe(45);
    expect(bal?.reservedQty).toBe(0);
  });

  it("records variance without stock mutation via recordVariance", async () => {
    const { svc, balances } = service();
    await svc.recordVariance(orderId, 5, {
      ...ctx,
      varianceReason: "Unresolved reservation qty on order 601",
    });

    const bal = await balances.getBalance(productId, "BAK-601", "WH-MAIN");
    expect(bal?.version).toBe(1);

    const evts = await svc.listEvents(orderId);
    expect(evts.some((e) => e.eventType === "stock_variance_recorded")).toBe(true);
    expect(evts.some((e) => e.eventType === "stock_consumption_finalized")).toBe(false);
  });

  it("denies finalize before dispatch_finalized", async () => {
    const { svc } = service();
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
    const { svc } = service();
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
    const { svc } = service();
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
    const { svc } = service();
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

  it("requires existing balance row (no silent bootstrap)", async () => {
    const { svc } = service();
    const emptyBalances = createInMemoryStockBalanceRepository([]);
    const svcNoBal = createStockFinalizationService({
      balances: emptyBalances,
      movements: createInMemoryStockMovementRepository(),
      lineage: createInMemoryStockLineageRepository(),
      events: createInMemoryStockFinalizationEventSink(),
    });
    await expect(svcNoBal.finalizeConsumption(finalizedInput, finalizeParams, ctx)).rejects.toMatchObject({
      code: "balance_not_found",
    });
    expect(await svcNoBal.listLineage(orderId)).toHaveLength(0);
  });

  it("requires finalizeReason", async () => {
    const { svc } = service();
    await expect(
      svc.finalizeConsumption(finalizedInput, finalizeParams, { ...ctx, finalizeReason: "  " }),
    ).rejects.toMatchObject({ code: "reason_required" });
  });

  it("denies finance role", async () => {
    const { svc } = service();
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

  it("rejects duplicate finalize when consumption_finalized lineage exists", async () => {
    const { svc } = service();
    const params = {
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
    };
    await svc.finalizeConsumption(finalizedInput, params, ctx);
    await expect(svc.finalizeConsumption(finalizedInput, params, ctx)).rejects.toMatchObject({
      code: "already_finalized",
    });
  });

  it("reversal restores reserved_qty released at finalize", async () => {
    const { svc, balances } = service();
    const params = {
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
    };
    await svc.finalizeConsumption(finalizedInput, params, ctx);
    const afterFinalize = await balances.getBalance(productId, "BAK-601", "WH-MAIN");
    expect(afterFinalize?.availableQty).toBe(15);
    expect(afterFinalize?.reservedQty).toBe(0);

    const lineageRows = await svc.listLineage(orderId);
    const line = lineageRows.find((l) => l.lineageType === "consumption_finalized");
    expect(line).toBeDefined();

    await svc.reverseConsumption(
      finalizedInput,
      orderId,
      [
        {
          reservationId,
          productId,
          sku: "BAK-601",
          locationCode: "WH-MAIN",
          consumedQty: 5,
          movementId: line!.movementId,
          balanceVersion: afterFinalize!.version,
        },
      ],
      { ...ctx, reversalReason: "Correct dispatch correction" },
    );

    const afterReversal = await balances.getBalance(productId, "BAK-601", "WH-MAIN");
    expect(afterReversal?.availableQty).toBe(20);
    expect(afterReversal?.reservedQty).toBe(5);
  });
});
