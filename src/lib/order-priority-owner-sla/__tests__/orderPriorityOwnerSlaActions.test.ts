import { describe, expect, it } from "vitest";
import { OrderPriorityOwnerSlaActionBlockedError } from "../orderPriorityOwnerSlaTypes";
import { reassignOrderOwner, overrideOrderPriority } from "../orderPriorityOwnerSlaActions";

describe("Point74 order priority / owner / SLA actions (fail closed)", () => {
  it("blocks owner reassignment without Core RPC authority", async () => {
    await expect(
      reassignOrderOwner({
        orderId: "order-1",
        toUserId: "user-2",
        reason: "handoff",
        actorId: "user-1",
        idempotencyKey: "idem-1",
      }),
    ).rejects.toMatchObject({
      code: "CORE_PREREQUISITE_REASSIGN_ORDER_OWNER_V1",
    });
  });

  it("blocks priority override without Core RPC authority", async () => {
    await expect(
      overrideOrderPriority({
        orderId: "order-1",
        dispatchUrgency: "panic",
        reason: "festival rush",
        actorId: "user-1",
        idempotencyKey: "idem-2",
      }),
    ).rejects.toMatchObject({
      code: "CORE_PREREQUISITE_OVERRIDE_ORDER_PRIORITY_V1",
    });
  });

  it("surfaces typed blocked-action errors", async () => {
    try {
      await reassignOrderOwner({
        orderId: "order-1",
        toUserId: "user-2",
        reason: "handoff",
        actorId: "user-1",
        idempotencyKey: "idem-3",
      });
      expect.fail("expected blocked action");
    } catch (error) {
      expect(error).toBeInstanceOf(OrderPriorityOwnerSlaActionBlockedError);
    }
  });
});
