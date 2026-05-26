import type { ExecutionAuthorityContext, ExecutionAuthorityDecision, ExecutionQueueAction } from "./executionAuthorityTypes";
import {
  isForbiddenBusinessAction,
  isKnownQueueAction,
  roleHasQueueScope,
} from "./executionAuthorityMatrix";

export function assertExecutionAuthority(
  action: string,
  ctx: ExecutionAuthorityContext,
): ExecutionAuthorityDecision {
  if (isForbiddenBusinessAction(action)) {
    return { allowed: false, reason: `Forbidden business action: ${action}` };
  }
  if (!isKnownQueueAction(action)) {
    return { allowed: false, reason: `Unknown execution action: ${action}` };
  }
  return evaluateQueueAction(action, ctx);
}

function evaluateQueueAction(
  action: ExecutionQueueAction,
  ctx: ExecutionAuthorityContext,
): ExecutionAuthorityDecision {
  const role = ctx.actorRole.trim().toUpperCase();

  if (role === "SUPER_ADMIN") {
    return { allowed: true };
  }

  if (action === "queue:cancel" && role === "ADMIN") {
    return { allowed: false, reason: "ADMIN cannot cancel queue items without SUPER_ADMIN" };
  }

  if (!roleHasQueueScope(role, ctx.queueType)) {
    return { allowed: false, reason: `Role ${role} not scoped to queue ${ctx.queueType ?? "unknown"}` };
  }

  if (role === "ADMIN") {
    return { allowed: true };
  }

  if (role === "OPERATIONS_MANAGER") {
    return { allowed: true };
  }

  const scopedRoles = [
    "PRODUCTION_MANAGER",
    "ASSEMBLY_MANAGER",
    "DISPATCH_MANAGER",
    "DISPATCH_INCHARGE",
    "DISPATCH_HEAD",
    "STORE_INCHARGE",
    "STORE_READY_GOODS",
    "RGS_ADMIN",
    "SUPPORT_EXECUTIVE",
    "FINANCE_HEAD",
    "FINANCE_EXEC",
    "HOD_ARABIC",
    "HOD_FUSION",
    "HOD_CHOCOLATE",
    "HOD_BAKERY",
    "HOD_NUTS",
    "HOD_ASSEMBLY",
    "HOD_DRAGEES",
    "SECURITY_CONTROL",
    "PACKING_SUPERVISOR",
  ];

  if (scopedRoles.includes(role)) {
    return { allowed: true };
  }

  return { allowed: false, reason: `Role ${role} denied for ${action}` };
}

export function requireExecutionAuthority(
  action: string,
  ctx: ExecutionAuthorityContext,
): void {
  const decision = assertExecutionAuthority(action, ctx);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? `Execution denied: ${action}`);
  }
}
