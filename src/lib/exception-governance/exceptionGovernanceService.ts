import type {
  ExceptionDeclarationInput,
  ExceptionGovernanceRpcResult,
  ExceptionGovernanceWriteContext,
  ExceptionReadRecord,
  ExceptionReleaseInput,
} from "./exceptionGovernanceTypes";
import { ExceptionGovernanceError } from "./exceptionGovernanceTypes";
import { actionForCategory, assertExceptionAuthority, isForbiddenExceptionAction } from "./exceptionAuthorityGuard";
import { validateDeclarationInput, validateReleaseInput } from "./exceptionGovernanceValidation";
import { buildDeclarationRpc, buildReleaseRpc, idempotencyKeyFor } from "./exceptionRpcRouter";

export interface ExceptionGovernanceRpcClient {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
}

export interface ExceptionGovernanceServiceDeps {
  rpc: ExceptionGovernanceRpcClient;
}

function bindingKey(binding: ExceptionDeclarationInput["binding"]): string {
  return [
    binding.subsystem,
    binding.jobId,
    binding.reservationId,
    binding.transferId,
    binding.componentId,
    binding.assemblyJobId,
    binding.productId,
    binding.sku,
  ]
    .filter(Boolean)
    .join(":");
}

export function createExceptionGovernanceService(deps: ExceptionGovernanceServiceDeps) {
  const appliedKeys = new Set<string>();
  const readRecords: ExceptionReadRecord[] = [];

  function guardDeclare(input: ExceptionDeclarationInput, ctx: ExceptionGovernanceWriteContext) {
    const action = actionForCategory(input.category, "declare");
    if (isForbiddenExceptionAction(action)) {
      throw new ExceptionGovernanceError("forbidden_action", `Forbidden: ${action}`);
    }
    const auth = assertExceptionAuthority(action, {
      actorRole: ctx.actorRole,
      actorDepartment: ctx.actorDepartment,
      reason: ctx.reason,
      evidenceRef: ctx.evidenceRef,
      overrideReason: ctx.overrideReason,
    });
    if (!auth.allowed) throw new ExceptionGovernanceError("authority_denied", auth.reason);
    validateDeclarationInput(input, ctx);
  }

  function guardRelease(input: ExceptionReleaseInput, ctx: ExceptionGovernanceWriteContext) {
    const action = actionForCategory(input.category, "release");
    const auth = assertExceptionAuthority(action, {
      actorRole: ctx.actorRole,
      actorDepartment: ctx.actorDepartment,
      reason: ctx.reason,
      evidenceRef: ctx.evidenceRef,
      releaseAuthorizerRole: ctx.releaseAuthorizerRole,
      overrideReason: ctx.overrideReason,
    });
    if (!auth.allowed) throw new ExceptionGovernanceError("authority_denied", auth.reason);
    validateReleaseInput(input, ctx);
  }

  return {
    async declare(
      input: ExceptionDeclarationInput,
      ctx: ExceptionGovernanceWriteContext,
    ): Promise<ExceptionGovernanceRpcResult> {
      guardDeclare(input, ctx);
      const key = idempotencyKeyFor(input.category, ctx.correlationId, bindingKey(input.binding));
      if (appliedKeys.has(key)) {
        return { rpcName: "duplicate_replay", alreadyApplied: true, correlationId: ctx.correlationId };
      }

      const call = buildDeclarationRpc(input, ctx);
      const { error, data } = await deps.rpc.rpc(call.rpcName, call.args);
      if (error) {
        throw new ExceptionGovernanceError("rpc_unavailable", error.message);
      }

      appliedKeys.add(key);
      readRecords.push({
        id: String(data?.id ?? key),
        category: input.category,
        status: "open",
        subsystem: input.binding.subsystem,
        binding: input.binding,
        reason: ctx.reason,
        reasonCode: ctx.reasonCode ?? null,
        department: input.binding.department ?? ctx.actorDepartment ?? null,
        quantities: input.quantities ?? {},
        reportedAt: new Date().toISOString(),
        resolvedAt: null,
      });

      return {
        rpcName: call.rpcName,
        alreadyApplied: Boolean(data?.already_applied ?? data?.already_recorded),
        correlationId: ctx.correlationId,
      };
    },

    async release(
      input: ExceptionReleaseInput,
      ctx: ExceptionGovernanceWriteContext,
    ): Promise<ExceptionGovernanceRpcResult> {
      guardRelease(input, ctx);
      const key = idempotencyKeyFor(`release:${input.category}`, ctx.correlationId, input.targetId);
      if (appliedKeys.has(key)) {
        return { rpcName: "duplicate_replay", alreadyApplied: true, correlationId: ctx.correlationId };
      }

      const call = buildReleaseRpc(input, ctx);
      const { error, data } = await deps.rpc.rpc(call.rpcName, call.args);
      if (error) {
        throw new ExceptionGovernanceError("rpc_unavailable", error.message);
      }

      appliedKeys.add(key);
      const existing = readRecords.find((record) => record.id === input.targetId);
      if (existing) {
        existing.status = input.category === "quality_hold" ? "released" : "resolved";
        existing.resolvedAt = new Date().toISOString();
      }

      return {
        rpcName: call.rpcName,
        alreadyApplied: Boolean(data?.already_applied ?? data?.already_recorded),
        correlationId: ctx.correlationId,
      };
    },

    listOpen(): ExceptionReadRecord[] {
      return readRecords.filter((record) => record.status === "open");
    },

    listAll(): ExceptionReadRecord[] {
      return [...readRecords];
    },
  };
}

export type ExceptionGovernanceService = ReturnType<typeof createExceptionGovernanceService>;
