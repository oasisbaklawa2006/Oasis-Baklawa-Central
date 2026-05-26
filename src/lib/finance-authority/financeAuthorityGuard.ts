import type {
  FinanceAuthorityAction,
  FinanceAuthorityContext,
  FinanceAuthorityResult,
} from "./financeAuthorityTypes";

const MATRIX: Record<FinanceAuthorityAction, string[]> = {
  "finance:review": ["FINANCE_HEAD", "FINANCE_EXEC", "ADMIN", "SUPER_ADMIN"],
  "finance:verify_advance": ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
  "finance:place_hold": ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
  "finance:release_hold": ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
  "finance:commercial_release": ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
  "finance:reject_release": ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
  "finance:override_review": ["SUPER_ADMIN"],
};

const DENIED_OPERATIONAL = new Set([
  "DISPATCH_MANAGER",
  "DISPATCH_HEAD",
  "DISPATCH_INCHARGE",
  "OPS",
  "OPERATIONS_MANAGER",
]);

export function isForbiddenFinanceAction(action: string): boolean {
  return (
    action === "finance:capture_payment" ||
    action === "finance:generate_invoice" ||
    action === "finance:dispatch_complete" ||
    action === "finance:deduct_stock"
  );
}

export function assertFinanceAuthority(
  action: FinanceAuthorityAction | string,
  ctx: FinanceAuthorityContext,
): FinanceAuthorityResult {
  if (isForbiddenFinanceAction(action)) {
    return { allowed: false, reason: `Forbidden finance action: ${action}` };
  }

  const role = ctx.actorRole.trim().toUpperCase();

  if (DENIED_OPERATIONAL.has(role)) {
    return { allowed: false, reason: "Operations/dispatch roles cannot perform finance actions" };
  }

  const allowed = MATRIX[action as FinanceAuthorityAction];
  if (!allowed) {
    return { allowed: false, reason: `Unknown finance action: ${action}` };
  }

  if (action === "finance:review" && role === "FINANCE_EXEC") {
    return { allowed: true, reason: "Finance exec limited review" };
  }

  if (role === "SUPER_ADMIN") {
    if (!ctx.overrideReason?.trim() && action === "finance:override_review") {
      return { allowed: false, reason: "SUPER_ADMIN override requires overrideReason" };
    }
    return { allowed: true, reason: "SUPER_ADMIN" };
  }

  if (!allowed.includes(role)) {
    return { allowed: false, reason: `Role ${role} not permitted for ${action}` };
  }

  if (action === "finance:commercial_release" && role === "FINANCE_EXEC") {
    return { allowed: false, reason: "FINANCE_EXEC cannot commercially release" };
  }

  return { allowed: true, reason: "ok" };
}
