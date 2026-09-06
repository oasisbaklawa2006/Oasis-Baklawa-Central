import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFinanceControlBoundary } from "@/lib/order-authority/financeControlBoundary";
import { createFinanceGovernanceService, createInMemoryFinanceEventSink } from "./financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "./inMemoryFinanceEvidenceStore";
import {
  createSupabaseFinanceEvidenceStore,
  probeFinanceEvidenceTable,
} from "./supabaseFinanceEvidenceStore";

export type FinanceGovernancePersistenceMode = "core" | "demo" | "blocked";

export interface FinanceGovernanceBundle {
  service: ReturnType<typeof createFinanceGovernanceService>;
  persistenceMode: FinanceGovernancePersistenceMode;
  canExecuteWrites: boolean;
  corePrerequisiteMessage: string | null;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function createFinanceGovernanceBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
): Promise<FinanceGovernanceBundle> {
  const events = createInMemoryFinanceEventSink();
  const controlBoundary = await resolveFinanceControlBoundary(client, {
    forceDemo: options?.forceInMemory,
  });

  const service = createFinanceGovernanceService({
    evidence: createInMemoryFinanceEvidenceStore(),
    events,
    controlMode: controlBoundary.persistenceMode,
  });

  if (options?.forceInMemory || controlBoundary.persistenceMode === "demo") {
    return {
      service,
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
      corePrerequisiteMessage: null,
    };
  }

  if (!client) {
    return {
      service,
      persistenceMode: "blocked",
      canExecuteWrites: false,
      corePrerequisiteMessage: controlBoundary.prerequisiteMessage,
    };
  }

  const evidenceTableOk = await probeFinanceEvidenceTable(client).catch(() => false);
  if (!evidenceTableOk || controlBoundary.persistenceMode !== "core") {
    return {
      service,
      persistenceMode: "blocked",
      canExecuteWrites: false,
      corePrerequisiteMessage:
        controlBoundary.prerequisiteMessage ??
        "Core finance control authority unavailable — Central must not write finance_review_evidence directly.",
    };
  }

  return {
    service: createFinanceGovernanceService({
      evidence: createSupabaseFinanceEvidenceStore(client),
      events,
      controlMode: "core",
    }),
    persistenceMode: "core",
    canExecuteWrites: true,
    corePrerequisiteMessage: null,
  };
}
