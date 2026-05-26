import type { SupabaseClient } from "@supabase/supabase-js";
import { createFinanceGovernanceService, createInMemoryFinanceEventSink } from "./financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "./inMemoryFinanceEvidenceStore";
import {
  createSupabaseFinanceEvidenceStore,
  probeFinanceEvidenceTable,
} from "./supabaseFinanceEvidenceStore";

export async function createFinanceGovernanceBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
) {
  const events = createInMemoryFinanceEventSink();

  if (options?.forceInMemory || !client) {
    return {
      service: createFinanceGovernanceService({
        evidence: createInMemoryFinanceEvidenceStore(),
        events,
      }),
    };
  }

  const ok = await probeFinanceEvidenceTable(client).catch(() => false);
  if (!ok) {
    const testMode =
      typeof import.meta !== "undefined" &&
      (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true");
    if (testMode) {
      return {
        service: createFinanceGovernanceService({
          evidence: createInMemoryFinanceEvidenceStore(),
          events,
        }),
      };
    }
    throw new Error(
      "finance_review_evidence missing — apply 20260526130000_execution_os_phase4c_finance_governance.sql",
    );
  }

  return {
    service: createFinanceGovernanceService({
      evidence: createSupabaseFinanceEvidenceStore(client),
      events,
    }),
  };
}
