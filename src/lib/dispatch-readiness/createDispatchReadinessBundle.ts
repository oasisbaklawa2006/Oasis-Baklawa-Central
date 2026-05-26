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

export interface DispatchReadinessBundle {
  service: DispatchReadinessService;
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

  if (options?.forceInMemory || !client) {
    return {
      service: createDispatchReadinessService({
        evidence: createInMemoryDispatchEvidenceStore(),
        events,
      }),
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
      };
    }
    throw new Error(
      "dispatch_readiness_evidence table missing — apply migration 20260526120000_execution_os_phase4b_dispatch_readiness.sql",
    );
  }

  return {
    service: createDispatchReadinessService({
      evidence: createSupabaseDispatchEvidenceStore(client),
      events,
    }),
  };
}
