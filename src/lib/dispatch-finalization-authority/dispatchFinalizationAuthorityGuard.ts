import type {
  DispatchFinalizationAuthorityAction,
  DispatchFinalizationAuthorityContext,
  DispatchFinalizationAuthorityResult,
  DispatchFinalizationAuthorityRole,
  DispatchFinalizationForbiddenAction,
} from "./dispatchFinalizationAuthorityTypes";

const MATRIX: Record<DispatchFinalizationAuthorityAction, DispatchFinalizationAuthorityRole[]> = {
  "dispatch:finalize": ["DISPATCH_HEAD", "DISPATCH_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "dispatch:publish_customer_release": ["DISPATCH_HEAD", "DISPATCH_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "dispatch:reverse_release": ["DISPATCH_HEAD", "SUPER_ADMIN"],
  "dispatch:confirm_stock_consumption": ["DISPATCH_HEAD", "DISPATCH_MANAGER", "OPERATIONS_MANAGER", "ADMIN", "SUPER_ADMIN"],
};

const DENIED_ROLES: DispatchFinalizationAuthorityRole[] = ["FINANCE_HEAD", "FINANCE_EXEC", "OPS", "UNKNOWN"];

const KNOWN_ROLES: DispatchFinalizationAuthorityRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DISPATCH_MANAGER",
  "DISPATCH_HEAD",
  "DISPATCH_INCHARGE",
  "OPERATIONS_MANAGER",
  "OPS",
  "FINANCE_HEAD",
  "FINANCE_EXEC",
  "UNKNOWN",
];

function normalizeRole(role: string): DispatchFinalizationAuthorityRole {
  const r = role.trim().toUpperCase() as DispatchFinalizationAuthorityRole;
  if (KNOWN_ROLES.includes(r)) return r;
  return "UNKNOWN";
}

export function isForbiddenFinalizationAction(
  action: string,
): action is DispatchFinalizationForbiddenAction {
  return (
    action === "dispatch:auto_finalize" ||
    action === "dispatch:silent_release" ||
    action === "dispatch:bypass_finance" ||
    action === "dispatch:bypass_gate" ||
    action === "dispatch:mark_dispatched"
  );
}

export function assertDispatchFinalizationAuthority(
  action: DispatchFinalizationAuthorityAction | DispatchFinalizationForbiddenAction | string,
  ctx: DispatchFinalizationAuthorityContext,
): DispatchFinalizationAuthorityResult {
  if (isForbiddenFinalizationAction(action)) {
    return { allowed: false, reason: `Forbidden action: ${action}` };
  }

  const role = normalizeRole(ctx.actorRole);
  if (DENIED_ROLES.includes(role)) {
    return { allowed: false, reason: `Role ${role} cannot perform dispatch finalization` };
  }

  const allowedRoles = MATRIX[action as DispatchFinalizationAuthorityAction];
  if (!allowedRoles) {
    return { allowed: false, reason: `Unknown finalization action: ${action}` };
  }

  if (action === "dispatch:reverse_release") {
    if (!ctx.reversalReason?.trim()) {
      return { allowed: false, reason: "Reversal requires typed reversalReason" };
    }
  }

  if (role === "SUPER_ADMIN") {
    if (!ctx.overrideReason?.trim()) {
      return {
        allowed: false,
        reason: "SUPER_ADMIN requires typed overrideReason for finalization actions",
      };
    }
    return { allowed: true, reason: "SUPER_ADMIN override with reason" };
  }

  if (action === "dispatch:finalize" && role === "DISPATCH_MANAGER") {
    return { allowed: true, reason: "DISPATCH_MANAGER limited finalize" };
  }

  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: `Role ${role} not permitted for ${action}` };
  }

  return { allowed: true, reason: "ok" };
}
