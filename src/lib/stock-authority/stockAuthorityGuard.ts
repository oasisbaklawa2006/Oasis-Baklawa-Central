import type {
  StockAuthorityAction,
  StockAuthorityContext,
  StockAuthorityResult,
  StockAuthorityRole,
  StockForbiddenAction,
} from "./stockAuthorityTypes";

const MATRIX: Record<StockAuthorityAction, StockAuthorityRole[]> = {
  "stock:finalize_consumption": ["INVENTORY_MANAGER", "DISPATCH_HEAD", "ADMIN", "SUPER_ADMIN"],
  "stock:reverse_consumption": ["INVENTORY_MANAGER", "SUPER_ADMIN"],
  "stock:record_variance": ["INVENTORY_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "stock:quarantine": ["INVENTORY_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "stock:release_quarantine": ["INVENTORY_MANAGER", "ADMIN", "SUPER_ADMIN"],
};

const DENIED_ROLES: StockAuthorityRole[] = ["FINANCE_HEAD", "FINANCE_EXEC", "OPS", "UNKNOWN"];

const KNOWN_ROLES: StockAuthorityRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "INVENTORY_MANAGER",
  "DISPATCH_HEAD",
  "DISPATCH_MANAGER",
  "OPERATIONS_MANAGER",
  "FINANCE_HEAD",
  "FINANCE_EXEC",
  "OPS",
  "UNKNOWN",
];

function normalizeRole(role: string): StockAuthorityRole {
  const r = role.trim().toUpperCase() as StockAuthorityRole;
  if (KNOWN_ROLES.includes(r)) return r;
  return "UNKNOWN";
}

export function isForbiddenStockAction(action: string): action is StockForbiddenAction {
  return (
    action === "stock:silent_deduct" ||
    action === "stock:auto_adjust" ||
    action === "stock:delete_ledger"
  );
}

export function assertStockAuthority(
  action: StockAuthorityAction | StockForbiddenAction | string,
  ctx: StockAuthorityContext,
): StockAuthorityResult {
  if (isForbiddenStockAction(action)) {
    return { allowed: false, reason: `Forbidden action: ${action}` };
  }

  const role = normalizeRole(ctx.actorRole);
  if (DENIED_ROLES.includes(role)) {
    return { allowed: false, reason: `Role ${role} cannot mutate stock` };
  }

  const allowedRoles = MATRIX[action as StockAuthorityAction];
  if (!allowedRoles) {
    return { allowed: false, reason: `Unknown stock action: ${action}` };
  }

  if (action === "stock:reverse_consumption" && !ctx.reversalReason?.trim()) {
    return { allowed: false, reason: "Reversal requires typed reversalReason" };
  }

  if (action === "stock:record_variance" && !ctx.varianceReason?.trim()) {
    return { allowed: false, reason: "Variance requires typed varianceReason" };
  }

  if (role === "SUPER_ADMIN") {
    if (!ctx.overrideReason?.trim()) {
      return { allowed: false, reason: "SUPER_ADMIN requires typed overrideReason for stock actions" };
    }
    return { allowed: true, reason: "SUPER_ADMIN override with reason" };
  }

  if (action === "stock:finalize_consumption" && role === "DISPATCH_HEAD") {
    return { allowed: true, reason: "DISPATCH_HEAD dispatch-linked consumption confirm" };
  }

  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: `Role ${role} not permitted for ${action}` };
  }

  return { allowed: true, reason: "ok" };
}
