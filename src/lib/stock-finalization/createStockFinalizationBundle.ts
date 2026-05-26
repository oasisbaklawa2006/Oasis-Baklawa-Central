import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createStockFinalizationService,
  type StockFinalizationService,
} from "./stockFinalizationService";
import {
  createInMemoryStockBalanceRepository,
  createInMemoryStockFinalizationEventSink,
  createInMemoryStockLineageRepository,
  createInMemoryStockMovementRepository,
} from "./inMemoryStockFinalizationStore";
import {
  createSupabaseStockBalanceRepository,
  createSupabaseStockLineageRepository,
  createSupabaseStockMovementRepository,
  probeStockFinalizationTables,
} from "./supabaseStockFinalizationStore";

export type StockFinalizationPersistenceMode = "supabase" | "demo" | "unavailable";

export interface StockFinalizationBundle {
  service: StockFinalizationService;
  persistenceMode: StockFinalizationPersistenceMode;
  canExecuteWrites: boolean;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

function isDemoFinalizeAllowed(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_STOCK_FINALIZATION_DEMO === "true"
  );
}

export async function createStockFinalizationBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
): Promise<StockFinalizationBundle> {
  const events = createInMemoryStockFinalizationEventSink();

  if (options?.forceInMemory || !client) {
    return {
      service: createStockFinalizationService({
        balances: createInMemoryStockBalanceRepository(),
        movements: createInMemoryStockMovementRepository(),
        lineage: createInMemoryStockLineageRepository(),
        events,
      }),
      persistenceMode: "demo",
      canExecuteWrites: isDemoFinalizeAllowed(),
    };
  }

  const ok = await probeStockFinalizationTables(client).catch(() => false);
  if (!ok) {
    if (isTestMode()) {
      return {
        service: createStockFinalizationService({
          balances: createInMemoryStockBalanceRepository(),
          movements: createInMemoryStockMovementRepository(),
          lineage: createInMemoryStockLineageRepository(),
          events,
        }),
        persistenceMode: "demo",
        canExecuteWrites: true,
      };
    }
    return {
      service: createStockFinalizationService({
        balances: createInMemoryStockBalanceRepository(),
        movements: createInMemoryStockMovementRepository(),
        lineage: createInMemoryStockLineageRepository(),
        events,
      }),
      persistenceMode: "unavailable",
      canExecuteWrites: false,
    };
  }

  return {
    service: createStockFinalizationService({
      balances: createSupabaseStockBalanceRepository(client),
      movements: createSupabaseStockMovementRepository(client),
      lineage: createSupabaseStockLineageRepository(client),
      events,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: true,
  };
}
