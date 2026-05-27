import type { SupabaseClient } from "@supabase/supabase-js";
import { createFinanceGovernanceService, createInMemoryFinanceEventSink } from "./financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "./inMemoryFinanceEvidenceStore";
import {
  createSupabaseFinanceEvidenceStore,
  probeFinanceEvidenceTable,
} from "./supabaseFinanceEvidenceStore";

export type FinanceGovernancePersistenceMode = "supabase" | "demo" | "unavailable";

export interface FinanceGovernanceBundle {
  service: ReturnType<typeof createFinanceGovernanceService>;
  persistenceMode: FinanceGovernancePersistenceMode;
  canExecuteWrites: boolean;
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

  if (options?.forceInMemory) {
    return {
      service: createFinanceGovernanceService({
        evidence: createInMemoryFinanceEvidenceStore(),
        events,
      }),
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
    };
  }

  if (!client) {
    if (isTestMode()) {
      return {
        service: createFinanceGovernanceService({
          evidence: createInMemoryFinanceEvidenceStore(),
          events,
        }),
        persistenceMode: "demo",
        canExecuteWrites: true,
      };
    }
    return {
      service: createFinanceGovernanceService({
        evidence: createInMemoryFinanceEvidenceStore(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  const ok = await probeFinanceEvidenceTable(client).catch(() => false);
  if (!ok) {
    if (isTestMode()) {
      return {
        service: createFinanceGovernanceService({
          evidence: createInMemoryFinanceEvidenceStore(),
          events,
        }),
        persistenceMode: "demo",
        canExecuteWrites: true,
      };
    }
    return {
      service: createFinanceGovernanceService({
        evidence: createInMemoryFinanceEvidenceStore(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  return {
    service: createFinanceGovernanceService({
      evidence: createSupabaseFinanceEvidenceStore(client),
      events,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: true,
  };
}
