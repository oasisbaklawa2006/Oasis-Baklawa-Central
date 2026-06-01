import type {
  InventoryAuthorityContext,
  InventoryAuthorityDecision,
  InventoryReservationAction,
} from "./inventoryAuthorityTypes";
import {
  isForbiddenReservationSideEffect,
  isKnownReservationAction,
  roleCanPerformReservationAction,
} from "./inventoryAuthorityMatrix";

export function assertInventoryReservationAuthority(
  action: string,
  ctx: InventoryAuthorityContext,
): InventoryAuthorityDecision {
  if (isForbiddenReservationSideEffect(action)) {
    return { allowed: false, reason: `Forbidden side effect: ${action}` };
  }
  if (!isKnownReservationAction(action)) {
    return { allowed: false, reason: `Unknown reservation action: ${action}` };
  }
  if (action === "reservation:override" && !ctx.overrideReason?.trim()) {
    return { allowed: false, reason: "Override requires typed reason" };
  }
  const allowed = roleCanPerformReservationAction(
    ctx.actorRole,
    action as InventoryReservationAction,
    ctx.writeChannel ?? "reservation_board",
  );
  return allowed
    ? { allowed: true, reason: "ok" }
    : { allowed: false, reason: `Role ${ctx.actorRole} denied for ${action}` };
}
