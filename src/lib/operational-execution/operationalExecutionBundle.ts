import type { SupabaseClient } from "@supabase/supabase-js";
import { createInMemoryOperationalEventRepository } from "@/lib/operational-events/inMemoryOperationalEventRepository";
import { createSupabaseOperationalEventRepository } from "@/lib/operational-events/supabaseOperationalEventRepository";
import type { OperationalEventRepository } from "@/lib/operational-events/operationalEventRepository";
import { createInMemoryQueueStore } from "@/lib/persistent-queues/inMemoryQueueStore";
import {
  createPersistentQueueRepository,
  type PersistentQueueWriteService,
} from "@/lib/persistent-queues/persistentQueueRepository";
import { createSupabasePersistentQueueBundle } from "@/lib/persistent-queues/supabasePersistentQueueRepository";
import { createOperationalExecutionService, type OperationalExecutionService } from "./operationalExecutionService";
import {
  createInMemoryOperationalQueueReadStore,
  createSupabaseOperationalQueueReadStore,
  type OperationalQueueReadStore,
} from "./operationalQueueReadStore";

export interface OperationalExecutionBundle {
  repository: PersistentQueueWriteService;
  events: OperationalEventRepository;
  read: OperationalQueueReadStore;
  execution: OperationalExecutionService;
}

export function createSupabaseOperationalExecutionBundle(client: SupabaseClient): OperationalExecutionBundle {
  const base = createSupabasePersistentQueueBundle(client);
  return {
    ...base,
    read: createSupabaseOperationalQueueReadStore(client),
    execution: createOperationalExecutionService(base.repository),
  };
}

export function createInMemoryOperationalExecutionBundle(): OperationalExecutionBundle & {
  reset: () => void;
} {
  const events = createInMemoryOperationalEventRepository();
  const store = createInMemoryQueueStore();
  const repository = createPersistentQueueRepository(store, events);
  return {
    repository,
    events,
    read: createInMemoryOperationalQueueReadStore(store),
    execution: createOperationalExecutionService(repository),
    reset: () => {
      events._reset();
      store._reset();
    },
  };
}
