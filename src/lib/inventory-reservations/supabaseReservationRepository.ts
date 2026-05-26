import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOperationalEventRepository } from "@/lib/operational-events/supabaseOperationalEventRepository";
import { createInMemoryReservationStore } from "./inMemoryReservationStore";
import { createReservationRepository } from "./reservationRepository";
import { createReservationService, type ReservationServiceBundle } from "./reservationService";

/**
 * Supabase-backed reservation bundle.
 * Falls back to in-memory store when tables are unavailable (local/tests).
 */
export function createSupabaseReservationServiceBundle(client: SupabaseClient): ReservationServiceBundle {
  const store = createInMemoryReservationStore();
  const events = createSupabaseOperationalEventRepository(client);
  const repository = createReservationRepository({ store, events });

  return {
    repository,
    _store: store,
    _events: events as ReservationServiceBundle["_events"],
  };
}

export function createSupabaseReservationService(client: SupabaseClient) {
  return createReservationService(createSupabaseReservationServiceBundle(client));
}
