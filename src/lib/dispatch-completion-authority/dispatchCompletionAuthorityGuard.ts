import type {
  DispatchCompletionAuthorityAction,
  DispatchCompletionAuthorityContext,
  DispatchCompletionAuthorityResult,
  DispatchCompletionAuthorityRole,
  DispatchCompletionForbiddenAction,
} from "./dispatchCompletionAuthorityTypes";

const MATRIX: Record<DispatchCompletionAuthorityAction, DispatchCompletionAuthorityRole[]> = {
  "dispatch:completion_review": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "DISPATCH_INCHARGE",
    "OPERATIONS_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:attest_completion": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "DISPATCH_INCHARGE",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:place_completion_hold": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "OPERATIONS_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ],
  "dispatch:release_completion_hold": [
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "OPERATIONS_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ],
};

const KNOWN_ROLES: DispatchCompletionAuthorityRole[] = [
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

function normalizeRole(role: string): DispatchCompletionAuthorityRole {
  const r = role.trim().toUpperCase() as DispatchCompletionAuthorityRole;
  if (KNOWN_ROLES.includes(r)) return r;
  return "UNKNOWN";
}

export function isForbiddenCompletionAction(
  action: string,
): action is DispatchCompletionForbiddenAction {
  return (
    action === "dispatch:mark_dispatched" ||
    action === "dispatch:complete" ||
    action === "dispatch:final_release" ||
    action === "dispatch:mutate_order_status"
  );
}

export function assertDispatchCompletionAuthority(
  action: DispatchCompletionAuthorityAction | DispatchCompletionForbiddenAction | string,
  ctx: DispatchCompletionAuthorityContext,
): DispatchCompletionAuthorityResult {
  if (isForbiddenCompletionAction(action)) {
    return { allowed: false, reason: `Forbidden action: ${action}` };
  }

  const role = normalizeRole(ctx.actorRole);
  if (role === "FINANCE_HEAD" || role === "FINANCE_EXEC") {
    return { allowed: false, reason: "Finance roles cannot perform dispatch completion governance" };
  }

  if (role === "UNKNOWN") {
    return { allowed: false, reason: `Unknown role cannot perform ${action}` };
  }

  const allowedRoles = MATRIX[action as DispatchCompletionAuthorityAction];
  if (!allowedRoles) {
    return { allowed: false, reason: `Unknown dispatch completion action: ${action}` };
  }

  if (role === "SUPER_ADMIN") {
    if (!ctx.overrideReason?.trim()) {
      return {
        allowed: false,
        reason: "SUPER_ADMIN requires typed overrideReason for completion governance",
      };
    }
    return { allowed: true, reason: "SUPER_ADMIN override with reason" };
  }

  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: `Role ${role} not permitted for ${action}` };
  }

  return { allowed: true, reason: "ok" };
}
