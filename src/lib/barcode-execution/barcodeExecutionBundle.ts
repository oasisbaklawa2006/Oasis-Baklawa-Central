import type { SupabaseClient } from "@supabase/supabase-js";
import { createInMemoryOperationalEventRepository } from "@/lib/operational-events/inMemoryOperationalEventRepository";
import { createSupabaseOperationalEventRepository } from "@/lib/operational-events/supabaseOperationalEventRepository";
import type { OperationalEventRepository } from "@/lib/operational-events/operationalEventRepository";
import { createBarcodeExecutionService, type BarcodeExecutionService } from "./barcodeExecutionService";
import { createInMemoryScanRepository } from "./scanRepository";
import { createSupabaseScanRepository } from "./supabaseScanRepository";
import type { ScanRepository } from "./scanRepository";

export interface BarcodeExecutionBundle {
  scans: ScanRepository;
  events: OperationalEventRepository;
  execution: BarcodeExecutionService;
}

export function createSupabaseBarcodeExecutionBundle(client: SupabaseClient): BarcodeExecutionBundle {
  const events = createSupabaseOperationalEventRepository(client);
  const scans = createSupabaseScanRepository(client);
  return {
    scans,
    events,
    execution: createBarcodeExecutionService(scans, events),
  };
}

export function createInMemoryBarcodeExecutionBundle(): BarcodeExecutionBundle & {
  reset: () => void;
} {
  const events = createInMemoryOperationalEventRepository();
  const scans = createInMemoryScanRepository();
  return {
    scans,
    events,
    execution: createBarcodeExecutionService(scans, events),
    reset: () => {
      events._reset();
      scans._reset();
    },
  };
}
