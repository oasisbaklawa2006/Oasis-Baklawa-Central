import type {
  DispatchAuthorityAction,
  DispatchAuthorityContext,
  DispatchAuthorityResult,
  DispatchAuthorityRole,
  DispatchForbiddenAction,
} from "./dispatchAuthorityTypes";

const MATRIX: Record<DispatchAuthorityAction, DispatchAuthorityRole[]> = {
  "dispatch:readiness_review": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "DISPATCH_INCHARGE",
    "OPERATIONS_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:evidence_add": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "DISPATCH_INCHARGE",
    "OPERATIONS_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:evidence_reject": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:gate_check": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "DISPATCH_INCHARGE",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:exception_create": ["OPS", "OPERATIONS_MANAGER", "DISPATCH_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "dispatch:exception_clear": ["OPS", "OPERATIONS_MANAGER", "DISPATCH_MANAGER", "ADMIN", "SUPER_ADMIN"],
};

const KNOWN_ROLES: DispatchAuthorityRole[] = [
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

function normalizeRole(role: string): DispatchAuthorityRole {
  const r = role.trim().toUpperCase() as DispatchAuthorityRole;
  if (KNOWN_ROLES.includes(r)) return r;
  return "UNKNOWN";
}

export function isForbiddenDispatchAction(action: string): action is DispatchForbiddenAction {
  return (
    action === "dispatch:complete" ||
    action === "dispatch:mark_dispatched" ||
    action === "dispatch:final_release"
  );
}

export function assertDispatchAuthority(
  action: DispatchAuthorityAction | DispatchForbiddenAction | string,
  ctx: DispatchAuthorityContext,
): DispatchAuthorityResult {
  if (isForbiddenDispatchAction(action)) {
    return { allowed: false, reason: `Forbidden action: ${action}` };
  }

  const role = normalizeRole(ctx.actorRole);
  if (role === "FINANCE_HEAD" || role === "FINANCE_EXEC") {
    return { allowed: false, reason: "Finance roles cannot perform dispatch actions" };
  }

  if (role === "UNKNOWN") {
    return { allowed: false, reason: `Unknown role cannot perform ${action}` };
  }

  const allowedRoles = MATRIX[action as DispatchAuthorityAction];
  if (!allowedRoles) {
    return { allowed: false, reason: `Unknown dispatch action: ${action}` };
  }

  if (role === "SUPER_ADMIN") {
    if (!ctx.overrideReason?.trim()) {
      return {
        allowed: false,
        reason: "SUPER_ADMIN override requires typed overrideReason",
      };
    }
    return { allowed: true, reason: "SUPER_ADMIN override with reason" };
  }

  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: `Role ${role} not permitted for ${action}` };
  }

  return { allowed: true, reason: "ok" };
}
