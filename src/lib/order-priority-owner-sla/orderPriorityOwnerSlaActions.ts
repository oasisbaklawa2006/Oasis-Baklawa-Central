import {
  OrderPriorityOwnerSlaActionBlockedError,
  POINT74_CORE_PREREQUISITES,
} from "./orderPriorityOwnerSlaTypes";

export interface ReassignOrderOwnerInput {
  orderId: string;
  toUserId: string;
  reason: string;
  actorId: string;
  idempotencyKey: string;
}

export interface OverrideOrderPriorityInput {
  orderId: string;
  dispatchUrgency: "panic" | "standard";
  reason: string;
  actorId: string;
  idempotencyKey: string;
}

/** Fail closed — Core reassignment RPC is not yet published to Central types. */
export async function reassignOrderOwner(
  _input: ReassignOrderOwnerInput,
): Promise<never> {
  throw new OrderPriorityOwnerSlaActionBlockedError(
    "CORE_PREREQUISITE_REASSIGN_ORDER_OWNER_V1",
    `Order owner reassignment is blocked until Core publishes ${POINT74_CORE_PREREQUISITES.reassignOrderOwnerV1}.`,
  );
}

/** Fail closed — Core priority override RPC is not yet published to Central types. */
export async function overrideOrderPriority(
  _input: OverrideOrderPriorityInput,
): Promise<never> {
  throw new OrderPriorityOwnerSlaActionBlockedError(
    "CORE_PREREQUISITE_OVERRIDE_ORDER_PRIORITY_V1",
    `Order priority override is blocked until Core publishes ${POINT74_CORE_PREREQUISITES.overrideOrderPriorityV1}.`,
  );
}
