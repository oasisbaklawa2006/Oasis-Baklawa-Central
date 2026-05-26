import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOperationalEventRepository } from "@/lib/operational-events/supabaseOperationalEventRepository";
import { createInMemoryReservationStore } from "./inMemoryReservationStore";
import { createReservationRepository } from "./reservationRepository";
import { createReservationService, type ReservationServiceBundle } from "./reservationService";
import {
  createSupabaseInventoryReservationStore,
  probeInventoryReservationTables,
} from "./supabaseInventoryReservationStore";
import { isTestModeAllowInMemoryFallback } from "./reservationConcurrency";
import type { InventoryReservationStore } from "./reservationStoreContract";

export interface SupabaseReservationBundleOptions {
  /** Test-only: use in-memory store even when Supabase tables exist. */
  forceInMemory?: boolean;
}

/**
 * Resolves SQL-backed store for production. In-memory only when `forceInMemory` or
 * explicit test mode AND tables are missing.
 */
export async function resolveInventoryReservationStore(
  client: SupabaseClient,
  options: SupabaseReservationBundleOptions = {},
): Promise<InventoryReservationStore> {
  if (options.forceInMemory) {
    return createInMemoryReservationStore();
  }

  const tablesOk = await probeInventoryReservationTables(client).catch(() => false);
  if (!tablesOk) {
    if (isTestModeAllowInMemoryFallback()) {
      return createInMemoryReservationStore();
    }
    throw new Error(
      "inventory_reservations tables not available. Apply migration 20260526030000_execution_os_phase4a_inventory_reservation.sql before using the Supabase reservation bundle.",
    );
  }

  return createSupabaseInventoryReservationStore(client);
}

export function createSupabaseReservationServiceBundleSync(
  client: SupabaseClient,
  store: InventoryReservationStore,
): ReservationServiceBundle {
  const events = createSupabaseOperationalEventRepository(client);
  const repository = createReservationRepository({ store, events });
  return {
    repository,
    _store: store,
    _events: events as ReservationServiceBundle["_events"],
  };
}

/** Async bundle — prefers real Supabase persistence when tables exist. */
export async function createSupabaseReservationServiceBundle(
  client: SupabaseClient,
  options: SupabaseReservationBundleOptions = {},
): Promise<ReservationServiceBundle> {
  const store = await resolveInventoryReservationStore(client, options);
  return createSupabaseReservationServiceBundleSync(client, store);
}

export function createSupabaseReservationService(
  client: SupabaseClient,
  options?: SupabaseReservationBundleOptions,
) {
  return {
    async getService() {
      const bundle = await createSupabaseReservationServiceBundle(client, options);
      return createReservationService(bundle);
    },
    bundle: () => createSupabaseReservationServiceBundle(client, options),
  };
}

/** Convenience for hooks: sync in-memory fallback removed from default export path. */
export function createSupabaseReservationServiceFromStore(
  client: SupabaseClient,
  store: InventoryReservationStore,
): ReturnType<typeof createReservationService> {
  return createReservationService(createSupabaseReservationServiceBundleSync(client, store));
}
