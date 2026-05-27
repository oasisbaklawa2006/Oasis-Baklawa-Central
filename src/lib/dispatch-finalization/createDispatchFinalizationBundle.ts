import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDispatchFinalizationService,
  createInMemoryDispatchFinalizationEventSink,
  type DispatchFinalizationService,
} from "./dispatchFinalizationService";
import {
  createInMemoryDispatchLineageStore,
  createInMemoryOrderDispatchStatusRepository,
} from "./inMemoryDispatchFinalizationStore";
import {
  createSupabaseDispatchLineageStore,
  createSupabaseOrderDispatchStatusRepository,
  probeDispatchReleaseLineageTable,
} from "./supabaseDispatchFinalizationStore";

export type DispatchFinalizationPersistenceMode = "supabase" | "demo" | "unavailable";

export interface DispatchFinalizationBundle {
  service: DispatchFinalizationService;
  persistenceMode: DispatchFinalizationPersistenceMode;
  canExecuteWrites: boolean;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function createDispatchFinalizationBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
): Promise<DispatchFinalizationBundle> {
  const events = createInMemoryDispatchFinalizationEventSink();

  if (options?.forceInMemory) {
    return {
      service: createDispatchFinalizationService({
        lineage: createInMemoryDispatchLineageStore(),
        orders: createInMemoryOrderDispatchStatusRepository(),
        events,
      }),
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
    };
  }

  if (!client) {
    return {
      service: createDispatchFinalizationService({
        lineage: createInMemoryDispatchLineageStore(),
        orders: createInMemoryOrderDispatchStatusRepository(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  const ok = await probeDispatchReleaseLineageTable(client).catch(() => false);
  if (!ok) {
    if (isTestMode()) {
      return {
        service: createDispatchFinalizationService({
          lineage: createInMemoryDispatchLineageStore(),
          orders: createInMemoryOrderDispatchStatusRepository(),
          events,
        }),
        persistenceMode: "demo",
        canExecuteWrites: true,
      };
    }
    return {
      service: createDispatchFinalizationService({
        lineage: createInMemoryDispatchLineageStore(),
        orders: createInMemoryOrderDispatchStatusRepository(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  return {
    service: createDispatchFinalizationService({
      lineage: createSupabaseDispatchLineageStore(client),
      orders: createSupabaseOrderDispatchStatusRepository(client),
      events,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: true,
  };
}
