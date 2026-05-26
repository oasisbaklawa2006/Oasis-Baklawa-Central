import { describe, expect, it } from "vitest";
import { assertGovernedDispatchTransition, updateOrderDispatchStatus } from "../dispatchStatusMutation";
import { createInMemoryOrderDispatchStatusRepository } from "../inMemoryDispatchFinalizationStore";
import { DispatchFinalizationError } from "../dispatchFinalizationTypes";

describe("dispatchStatusMutation", () => {
  it("allows cleared_for_dispatch → dispatched", () => {
    expect(() => assertGovernedDispatchTransition("cleared_for_dispatch", "dispatched")).not.toThrow();
  });

  it("rejects draft → dispatched", () => {
    expect(() => assertGovernedDispatchTransition("draft", "dispatched")).toThrow(DispatchFinalizationError);
  });

  it("optimistic lock rejects stale status", async () => {
    const repo = createInMemoryOrderDispatchStatusRepository({
      "order-1": { status: "packed_ready" },
    });
    await expect(
      updateOrderDispatchStatus(repo, {
        orderId: "order-1",
        expectedPreviousStatus: "cleared_for_dispatch",
        nextStatus: "dispatched",
      }),
    ).rejects.toMatchObject({ code: "stale_status" });
  });

  it("updates when status matches", async () => {
    const repo = createInMemoryOrderDispatchStatusRepository({
      "order-1": { status: "cleared_for_dispatch" },
    });
    const result = await updateOrderDispatchStatus(repo, {
      orderId: "order-1",
      expectedPreviousStatus: "cleared_for_dispatch",
      nextStatus: "dispatched",
      trackingNumber: "LR123",
    });
    expect(result.updated).toBe(true);
    expect(result.nextStatus).toBe("dispatched");
    const live = await repo.getOrderStatus("order-1");
    expect(live?.status).toBe("dispatched");
  });
});
