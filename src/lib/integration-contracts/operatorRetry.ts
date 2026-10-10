import { requireExecutionAuthority } from "@/lib/execution-authority/executionAuthorityGuard";
import type { ExecutionAuthorityContext } from "@/lib/execution-authority/executionAuthorityTypes";
import { preserveOperatorRetryIdentity, type IdempotentCommandIdentity } from "./idempotency";
import { IntegrationError, classifyIntegrationError } from "./integrationError";

export interface OperatorRetryContext extends IdempotentCommandIdentity {
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  queueType?: ExecutionAuthorityContext["queueType"];
  /** When true, caller asserts AAL2 step-up was completed for this retry. */
  stepUpVerified?: boolean;
}

export interface SensitiveOperatorRetryOptions {
  requiresStepUp?: boolean;
}

const SENSITIVE_RETRY_ACTIONS = new Set([
  "queue:retry",
  "finance:retry",
  "dispatch:retry",
]);

function resolveAuthorityAction(action: string): string {
  switch (action) {
    case "queue:retry":
      return "queue:create";
    case "finance:retry":
    case "dispatch:retry":
      return "queue:start";
    default:
      return action;
  }
}

/**
 * Operator-initiated retry must preserve source identity and pass authority gates.
 * Does not bypass Core idempotency or AAL2 requirements.
 */
export function assertOperatorRetryAllowed(
  action: string,
  ctx: OperatorRetryContext,
  options?: SensitiveOperatorRetryOptions,
): void {
  const identity = preserveOperatorRetryIdentity(ctx);
  const authorityAction = resolveAuthorityAction(action);

  const authorityCtx: ExecutionAuthorityContext = {
    actorUserId: identity.actorUserId,
    actorRole: identity.actorRole,
    actorDepartment: identity.actorDepartment,
    queueType: identity.queueType,
    idempotencyKey: identity.idempotencyKey,
  };

  requireExecutionAuthority(authorityAction, authorityCtx);

  const requiresStepUp = options?.requiresStepUp ?? SENSITIVE_RETRY_ACTIONS.has(action);
  if (requiresStepUp && !ctx.stepUpVerified) {
    throw new IntegrationError({
      code: "unauthorized",
      failureClass: "permanent",
      message: "Step-up authentication (AAL2) required for operator retry",
      retryable: false,
      source: "operator-retry",
    });
  }
}

export function formatOperatorRetryDenied(err: unknown): string {
  const classified = classifyIntegrationError({ err, source: "operator-retry" });
  if (classified.code === "authority_denied" || classified.code === "forbidden") {
    return "You do not have permission to retry this action.";
  }
  if (classified.code === "unauthorized") {
    return "Authentication required before retry.";
  }
  return classified.message;
}
