import type {
  ExceptionAuthorityAction,
  ExceptionAuthorityContext,
  ExceptionAuthorityResult,
  ExceptionAuthorityRole,
  ExceptionForbiddenAction,
} from "./exceptionGovernanceTypes";

const MATRIX: Record<ExceptionAuthorityAction, ExceptionAuthorityRole[]> = {
  "exception:declare_wastage": ["HOD", "OPERATIONS_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "exception:declare_rejection": ["HOD", "QUALITY_CONTROLLER", "INVENTORY_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "exception:declare_shortage": ["INVENTORY_MANAGER", "OPERATIONS_MANAGER", "HOD", "ADMIN", "SUPER_ADMIN"],
  "exception:declare_blocker": ["HOD", "OPERATIONS_MANAGER", "QUALITY_CONTROLLER", "ADMIN", "SUPER_ADMIN"],
  "exception:declare_quality_hold": ["QUALITY_CONTROLLER", "INVENTORY_MANAGER", "HOD", "ADMIN", "SUPER_ADMIN"],
  "exception:release_quality_hold": ["QUALITY_CONTROLLER", "INVENTORY_MANAGER", "ADMIN", "SUPER_ADMIN"],
  "exception:release_blocker": ["HOD", "OPERATIONS_MANAGER", "QUALITY_CONTROLLER", "ADMIN", "SUPER_ADMIN"],
  "exception:resolve": ["HOD", "OPERATIONS_MANAGER", "QUALITY_CONTROLLER", "ADMIN", "SUPER_ADMIN"],
};

const RELEASE_REQUIRES_INDEPENDENT_AUTH: ExceptionAuthorityAction[] = [
  "exception:release_quality_hold",
  "exception:release_blocker",
];

const FINANCE_DENIED: ExceptionAuthorityRole[] = ["FINANCE_HEAD"];

const KNOWN_ROLES: ExceptionAuthorityRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "HOD",
  "INVENTORY_MANAGER",
  "QUALITY_CONTROLLER",
  "DISPATCH_HEAD",
  "DISPATCH_MANAGER",
  "FINANCE_HEAD",
  "UNKNOWN",
];

function normalizeRole(role: string): ExceptionAuthorityRole {
  const normalized = role.trim().toUpperCase() as ExceptionAuthorityRole;
  if (KNOWN_ROLES.includes(normalized)) return normalized;
  if (normalized.startsWith("HOD_")) return "HOD";
  return "UNKNOWN";
}

export function isForbiddenExceptionAction(action: string): action is ExceptionForbiddenAction {
  return (
    action === "exception:direct_stock_mutate" ||
    action === "exception:direct_job_mutate" ||
    action === "exception:shadow_order_reject"
  );
}

export function actionForCategory(
  category: string,
  mode: "declare" | "release" = "declare",
): ExceptionAuthorityAction {
  if (mode === "release") {
    if (category === "quality_hold") return "exception:release_quality_hold";
    if (category === "blocker") return "exception:release_blocker";
    return "exception:resolve";
  }
  switch (category) {
    case "wastage":
      return "exception:declare_wastage";
    case "rejection":
      return "exception:declare_rejection";
    case "shortage":
      return "exception:declare_shortage";
    case "blocker":
      return "exception:declare_blocker";
    case "quality_hold":
      return "exception:declare_quality_hold";
    default:
      return "exception:declare_blocker";
  }
}

export function assertExceptionAuthority(
  action: ExceptionAuthorityAction | ExceptionForbiddenAction | string,
  ctx: ExceptionAuthorityContext,
): ExceptionAuthorityResult {
  if (isForbiddenExceptionAction(action)) {
    return { allowed: false, reason: `Forbidden exception action: ${action}` };
  }

  const role = normalizeRole(ctx.actorRole);
  if (FINANCE_DENIED.includes(role)) {
    return { allowed: false, reason: "Finance roles cannot mutate operational exceptions" };
  }

  const allowedRoles = MATRIX[action as ExceptionAuthorityAction];
  if (!allowedRoles) {
    return { allowed: false, reason: `Unknown exception action: ${action}` };
  }

  if (!ctx.reason?.trim() && action !== "exception:resolve") {
    return { allowed: false, reason: "Typed reason is required" };
  }

  if (RELEASE_REQUIRES_INDEPENDENT_AUTH.includes(action as ExceptionAuthorityAction)) {
    const authorizer = ctx.releaseAuthorizerRole?.trim();
    if (!authorizer) {
      return { allowed: false, reason: "Release requires independent authorizer role" };
    }
    const normalizedAuthorizer = normalizeRole(authorizer);
    if (normalizedAuthorizer === role) {
      return { allowed: false, reason: "Release authorizer must differ from declaring actor" };
    }
    if (!MATRIX[action as ExceptionAuthorityAction].includes(normalizedAuthorizer)) {
      return { allowed: false, reason: `Authorizer role ${authorizer} cannot release this exception` };
    }
  }

  if (role === "SUPER_ADMIN") {
    if (!ctx.overrideReason?.trim()) {
      return { allowed: false, reason: "SUPER_ADMIN requires typed overrideReason" };
    }
    return { allowed: true, reason: "SUPER_ADMIN override with reason" };
  }

  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: `Role ${role} not permitted for ${action}` };
  }

  return { allowed: true, reason: "ok" };
}
