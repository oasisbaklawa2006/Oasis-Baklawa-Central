import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDispatchCompletionService,
  createInMemoryDispatchCompletionEventSink,
  type DispatchCompletionService,
} from "./dispatchCompletionService";
import { createInMemoryDispatchCompletionEvidenceStore } from "./inMemoryDispatchCompletionEvidenceStore";
import {
  createSupabaseDispatchCompletionEvidenceStore,
  probeDispatchCompletionEvidenceTable,
} from "./supabaseDispatchCompletionEvidenceStore";

export interface DispatchCompletionBundle {
  service: DispatchCompletionService;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function createDispatchCompletionBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
): Promise<DispatchCompletionBundle> {
  const events = createInMemoryDispatchCompletionEventSink();

  if (options?.forceInMemory || !client) {
    return {
      service: createDispatchCompletionService({
        evidence: createInMemoryDispatchCompletionEvidenceStore(),
        events,
      }),
    };
  }

  const tablesOk = await probeDispatchCompletionEvidenceTable(client).catch(() => false);
  if (!tablesOk) {
    if (isTestMode()) {
      return {
        service: createDispatchCompletionService({
          evidence: createInMemoryDispatchCompletionEvidenceStore(),
          events,
        }),
      };
    }
    throw new Error(
      "dispatch_completion_evidence table missing — apply migration 20260526140000_execution_os_phase4d_dispatch_completion.sql",
    );
  }

  return {
    service: createDispatchCompletionService({
      evidence: createSupabaseDispatchCompletionEvidenceStore(client),
      events,
    }),
  };
}
