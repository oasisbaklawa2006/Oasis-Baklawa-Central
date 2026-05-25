import { describe, expect, it } from "vitest";
import {
  createDispatchFinalizationService,
  createInMemoryDispatchFinalizationEventSink,
} from "../dispatchFinalizationService";
import {
  createInMemoryDispatchLineageStore,
  createInMemoryOrderDispatchStatusRepository,
} from "../inMemoryDispatchFinalizationStore";
import { DispatchFinalizationError } from "../dispatchFinalizationTypes";
import type { DispatchFinalizationInput } from "../dispatchFinalizationTypes";

const ctx = {
  correlationId: "corr-4e",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "DISPATCH_HEAD",
  finalizeReason: "Governed staging finalize",
  overrideReason: null,
};

const orderId = "00000000-0000-4000-8000-000000000401";

const eligible: DispatchFinalizationInput = {
  orderId,
  currentOrderStatus: "cleared_for_dispatch",
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  completionStatus: "completion_attested",
  reservationReady: true,
  transporterHandoffFinalized: true,
  gateReference: "gate-ref-1",
  completionReference: "completion-attest-1",
  transporterReference: "BlueDart / LR-001",
  openReleaseBlockers: [],
};

function service() {
  return createDispatchFinalizationService({
    lineage: createInMemoryDispatchLineageStore(),
    orders: createInMemoryOrderDispatchStatusRepository({
      [orderId]: { status: "cleared_for_dispatch" },
    }),
    events: createInMemoryDispatchFinalizationEventSink(),
  });
}

describe("dispatchFinalizationService", () => {
  it("finalizes with lineage and orders.status mutation", async () => {
    const svc = service();
    const result = await svc.finalizeDispatch(eligible, ctx, { trackingNumber: "LR-001" });
    expect(result.statusUpdate.nextStatus).toBe("dispatched");
    const lineage = await svc.listLineage(orderId);
    expect(lineage.some((l) => l.releaseType === "finalize")).toBe(true);
    const evts = await svc.listEvents(orderId);
    expect(evts.some((e) => e.eventType === "dispatch_finalized")).toBe(true);
  });

  it("denies finance role", async () => {
    const svc = service();
    await expect(
      svc.finalizeDispatch(eligible, { ...ctx, actorRole: "FINANCE_HEAD" }),
    ).rejects.toThrow(DispatchFinalizationError);
  });

  it("publishes customer-safe preview after finalize", async () => {
    const svc = service();
    await svc.finalizeDispatch(eligible, ctx);
    const { preview } = await svc.publishCustomerRelease(orderId, {
      ...ctx,
      actorRole: "DISPATCH_HEAD",
    });
    expect(preview.some((s) => s.label === "Dispatched")).toBe(true);
    expect(preview.some((s) => s.label === "In transit")).toBe(true);
  });

  it("stock confirmation does not imply deduction", async () => {
    const svc = service();
    await svc.finalizeDispatch(eligible, ctx);
    await svc.confirmStockConsumptionIntent(orderId, "confirmed", "intent only", ctx);
    const lineage = await svc.listLineage(orderId);
    const stock = lineage.find((l) => l.releaseType === "stock_confirmation");
    expect(stock?.metadata).toMatchObject({ physicalDeduction: false });
  });

  it("reversal requires reason and creates compensating lineage", async () => {
    const svc = service();
    await svc.finalizeDispatch(eligible, ctx);
    await svc.requestDispatchReversal(orderId, {
      ...ctx,
      reversalReason: "Wrong LR scanned",
    });
    await svc.completeDispatchReversal(orderId, {
      ...ctx,
      reversalReason: "Wrong LR scanned",
    });
    const lineage = await svc.listLineage(orderId);
    expect(lineage.some((l) => l.releaseType === "reversal")).toBe(true);
  });
});
