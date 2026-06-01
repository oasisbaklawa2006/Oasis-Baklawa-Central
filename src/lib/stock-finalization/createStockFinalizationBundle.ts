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
import { createSupabaseReservationService } from "@/lib/inventory-reservations/supabaseReservationRepository";
import type { ReservationService } from "@/lib/inventory-reservations/reservationService";

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

  let reservationService: ReservationService | undefined;
  try {
    reservationService = await createSupabaseReservationService(client).getService();
  } catch {
    reservationService = undefined;
  }

  return {
    service: createStockFinalizationService({
      balances: createSupabaseStockBalanceRepository(client),
      movements: createSupabaseStockMovementRepository(client),
      lineage: createSupabaseStockLineageRepository(client),
      events,
      reservations: reservationService
        ? {
            fulfillAfterStockConsumption: async (input, ctx) => {
              const row = await reservationService!.getReservation(input.reservationId);
              if (!row) {
                throw new Error(`Reservation ${input.reservationId} not found for post–4G fulfill`);
              }
              await reservationService!.fulfillAfterStockConsumption(
                {
                  reservationId: input.reservationId,
                  expectedVersion: row.version,
                  consumedQty: input.consumedQty,
                  reasonCode: input.reasonCode,
                },
                {
                  correlationId: ctx.correlationId,
                  actorUserId: ctx.actorUserId,
                  actorRole: ctx.actorRole,
                  actorDepartment: "stock_finalization",
                },
              );
            },
          }
        : undefined,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: true,
  };
}
