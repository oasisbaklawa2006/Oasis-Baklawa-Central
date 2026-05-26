import type { InventoryReservationAction } from "./inventoryAuthorityTypes";

const FINANCE_ROLES = new Set(["FINANCE_HEAD", "FINANCE_EXEC"]);
const DISPATCH_ROLES = new Set(["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"]);

const INVENTORY_FULL = new Set([
  "INVENTORY_MANAGER",
  "STORE_INCHARGE",
  "STORE_READY_GOODS",
  "RGS_ADMIN",
  "OPERATIONS_MANAGER",
  "ADMIN",
]);

const OPS_RESERVE_RELEASE = new Set(["OPERATIONS_MANAGER", ...INVENTORY_FULL]);

export function isKnownReservationAction(action: string): action is InventoryReservationAction {
  return (
    action === "reservation:create" ||
    action === "reservation:reserve" ||
    action === "reservation:partial_reserve" ||
    action === "reservation:release" ||
    action === "reservation:expire" ||
    action === "reservation:fulfill" ||
    action === "reservation:cancel" ||
    action === "reservation:override"
  );
}

export function isForbiddenReservationSideEffect(action: string): boolean {
  const forbidden = [
    "deductStock",
    "dispatch:complete",
    "finance:approve",
    "finance:release",
    "payment:",
    "invoice:",
    "notification:",
    "autoAllocate",
    "autoRelease",
    "autoDispatch",
  ];
  return forbidden.some((f) => action.includes(f));
}

export function roleCanPerformReservationAction(
  role: string,
  action: InventoryReservationAction,
): boolean {
  const r = role.trim().toUpperCase();
  if (r === "SUPER_ADMIN") return true;
  if (FINANCE_ROLES.has(r)) return false;
  if (action === "reservation:override") return r === "SUPER_ADMIN";
  if (action === "reservation:fulfill") return DISPATCH_ROLES.has(r) ? false : INVENTORY_FULL.has(r) || OPS_RESERVE_RELEASE.has(r);
  if (action === "reservation:expire") return INVENTORY_FULL.has(r) || r === "OPERATIONS_MANAGER";
  if (
    action === "reservation:create" ||
    action === "reservation:reserve" ||
    action === "reservation:partial_reserve"
  ) {
    return OPS_RESERVE_RELEASE.has(r);
  }
  if (action === "reservation:release" || action === "reservation:cancel") {
    return OPS_RESERVE_RELEASE.has(r);
  }
  return false;
}
