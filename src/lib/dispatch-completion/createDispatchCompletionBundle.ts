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

export type DispatchCompletionPersistenceMode = "supabase" | "demo" | "unavailable";

export interface DispatchCompletionBundle {
  service: DispatchCompletionService;
  persistenceMode: DispatchCompletionPersistenceMode;
  canExecuteWrites: boolean;
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

  if (options?.forceInMemory) {
    return {
      service: createDispatchCompletionService({
        evidence: createInMemoryDispatchCompletionEvidenceStore(),
        events,
      }),
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
    };
  }

  if (!client) {
    return {
      service: createDispatchCompletionService({
        evidence: createInMemoryDispatchCompletionEvidenceStore(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
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
        persistenceMode: "demo",
        canExecuteWrites: true,
      };
    }
    return {
      service: createDispatchCompletionService({
        evidence: createInMemoryDispatchCompletionEvidenceStore(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  return {
    service: createDispatchCompletionService({
      evidence: createSupabaseDispatchCompletionEvidenceStore(client),
      events,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: true,
  };
}
