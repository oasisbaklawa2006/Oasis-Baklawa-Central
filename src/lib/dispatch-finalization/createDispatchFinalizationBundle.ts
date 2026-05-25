import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDispatchFinalizationService,
  createInMemoryDispatchFinalizationEventSink,
  type DispatchFinalizationService,
} from "./dispatchFinalizationService";
import { createInMemoryDispatchLineageStore, createInMemoryOrderDispatchStatusRepository } from "./inMemoryDispatchFinalizationStore";
import {
  createSupabaseDispatchLineageStore,
  createSupabaseOrderDispatchStatusRepository,
  probeDispatchReleaseLineageTable,
} from "./supabaseDispatchFinalizationStore";

export interface DispatchFinalizationBundle {
  service: DispatchFinalizationService;
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

  if (options?.forceInMemory || !client) {
    return {
      service: createDispatchFinalizationService({
        lineage: createInMemoryDispatchLineageStore(),
        orders: createInMemoryOrderDispatchStatusRepository(),
        events,
      }),
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
      };
    }
    throw new Error(
      "dispatch_release_lineage missing — apply 20260526150000_execution_os_phase4e_dispatch_finalization.sql",
    );
  }

  return {
    service: createDispatchFinalizationService({
      lineage: createSupabaseDispatchLineageStore(client),
      orders: createSupabaseOrderDispatchStatusRepository(client),
      events,
    }),
  };
}
