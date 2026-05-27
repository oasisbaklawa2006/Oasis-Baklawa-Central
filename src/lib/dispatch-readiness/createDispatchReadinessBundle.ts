import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDispatchReadinessService,
  createInMemoryDispatchEventSink,
  type DispatchReadinessService,
} from "./dispatchReadinessService";
import { createInMemoryDispatchEvidenceStore } from "./inMemoryDispatchEvidenceStore";
import {
  createSupabaseDispatchEvidenceStore,
  probeDispatchEvidenceTable,
} from "./supabaseDispatchEvidenceStore";

export type DispatchReadinessPersistenceMode = "supabase" | "demo" | "unavailable";

export interface DispatchReadinessBundle {
  service: DispatchReadinessService;
  persistenceMode: DispatchReadinessPersistenceMode;
  canExecuteWrites: boolean;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function createDispatchReadinessBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
): Promise<DispatchReadinessBundle> {
  const events = createInMemoryDispatchEventSink();

  if (options?.forceInMemory) {
    return {
      service: createDispatchReadinessService({
        evidence: createInMemoryDispatchEvidenceStore(),
        events,
      }),
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
    };
  }

  if (!client) {
    return {
      service: createDispatchReadinessService({
        evidence: createInMemoryDispatchEvidenceStore(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  const tablesOk = await probeDispatchEvidenceTable(client).catch(() => false);
  if (!tablesOk) {
    if (isTestMode()) {
      return {
        service: createDispatchReadinessService({
          evidence: createInMemoryDispatchEvidenceStore(),
          events,
        }),
        persistenceMode: "demo",
        canExecuteWrites: true,
      };
    }
    return {
      service: createDispatchReadinessService({
        evidence: createInMemoryDispatchEvidenceStore(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  return {
    service: createDispatchReadinessService({
      evidence: createSupabaseDispatchEvidenceStore(client),
      events,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: true,
  };
}
