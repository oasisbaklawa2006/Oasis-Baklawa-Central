import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFinanceControlCorrelationId,
  buildFinanceControlIdempotencyKey,
  formatFinanceControlPrerequisite,
  probeFinanceControlAuthority,
  type FinanceControlBinding,
  type FinanceControlWriteContext,
} from "@/lib/order-authority/financeControlAuthorityClient";
import type { Point80RequiredCoreRpc } from "@/lib/order-authority/financeControlSurfaceCensus";

export type FinanceControlPersistenceMode = "core" | "demo" | "blocked";

export interface FinanceControlBoundaryState {
  persistenceMode: FinanceControlPersistenceMode;
  canExecuteWrites: boolean;
  missingCoreRpcs: Point80RequiredCoreRpc[];
  prerequisiteMessage: string | null;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function resolveFinanceControlBoundary(
  _client?: SupabaseClient,
  options?: { forceDemo?: boolean },
): Promise<FinanceControlBoundaryState> {
  if (options?.forceDemo || isTestMode()) {
    return {
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
      missingCoreRpcs: [],
      prerequisiteMessage: null,
    };
  }

  const probe = await probeFinanceControlAuthority().catch(() => ({
    available: false,
    missingCoreRpcs: [] as Point80RequiredCoreRpc[],
  }));

  if (probe.available) {
    return {
      persistenceMode: "core",
      canExecuteWrites: true,
      missingCoreRpcs: [],
      prerequisiteMessage: null,
    };
  }

  return {
    persistenceMode: "blocked",
    canExecuteWrites: false,
    missingCoreRpcs: probe.missingCoreRpcs,
    prerequisiteMessage: formatFinanceControlPrerequisite(probe.missingCoreRpcs),
  };
}

export async function buildFinanceControlWriteContext(input: {
  actorId: string;
  actorRole: string;
  reason: string;
  evidenceReference: string;
  scope: string;
  identity: unknown;
  sourceReference?: string | null;
  expectedSourceVersion?: number | null;
  requestActorId?: string | null;
}): Promise<FinanceControlWriteContext> {
  const identity = JSON.stringify(input.identity);
  const [correlationId, idempotencyKey] = await Promise.all([
    buildFinanceControlCorrelationId(input.scope, identity),
    buildFinanceControlIdempotencyKey(input.scope, identity),
  ]);
  return {
    actorId: input.actorId,
    actorRole: input.actorRole,
    reason: input.reason,
    evidenceReference: input.evidenceReference,
    sourceChannel: "CENTRAL",
    sourceReference: input.sourceReference ?? null,
    correlationId,
    idempotencyKey,
    expectedSourceVersion: input.expectedSourceVersion ?? null,
    requestActorId: input.requestActorId ?? null,
  };
}

export type { FinanceControlBinding, FinanceControlWriteContext };
