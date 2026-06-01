/** When true, legacy dispatch shortcuts are hidden from operator roles (Phase 24A). */
export function isGoldenChainOperatorPrimary(): boolean {
  if (typeof import.meta === "undefined") return true;
  const flag = import.meta.env?.VITE_GOLDEN_CHAIN_OPERATOR_ENABLED;
  if (flag === "false") return false;
  return true;
}

const OPERATOR_ROLES = new Set([
  "DISPATCH_MANAGER",
  "DISPATCH_INCHARGE",
  "DISPATCH_HEAD",
  "PACKING_SUPERVISOR",
  "STORE_INCHARGE",
  "STORE_READY_GOODS",
  "FINANCE_EXEC",
  "FINANCE_HEAD",
  "GATE_SECURITY",
  "SECURITY_CONTROL",
]);

const SUPERVISOR_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
]);

export function isOperatorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toUpperCase();
  return OPERATOR_ROLES.has(r);
}

export function isSupervisorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return SUPERVISOR_ROLES.has(role.trim().toUpperCase());
}

/** Hide legacy six-board + finance-board from floor operators when wizard is primary. */
export function shouldHideAdvancedGovernanceNav(role: string | null | undefined): boolean {
  return isGoldenChainOperatorPrimary() && isOperatorRole(role) && !isSupervisorRole(role);
}

/** Hide order-management dispatch status shortcuts for operators. */
export function shouldBlockLegacyDispatchStatusChanges(role: string | null | undefined): boolean {
  return isGoldenChainOperatorPrimary() && isOperatorRole(role) && !isSupervisorRole(role);
}
