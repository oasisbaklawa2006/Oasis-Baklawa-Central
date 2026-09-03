import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  mapScanRow,
  type OperationalScanRecord,
  type ScanRow,
} from "@/lib/barcode-execution/barcodeExecutionTypes";
import {
  mapOperationalScansToEventInputs,
  mapToTimelineRow,
  type ScanTimelineRow,
} from "@/lib/barcode/scanTimelineMapper";
import { deriveScanAnomalies, type ScanAnomaly } from "@/lib/barcode/scanLifecycle";

const DEFAULT_LIMIT = 100;

const operationalDb = supabase as unknown as SupabaseClient;

export interface ScanTimelineState {
  rows: ScanTimelineRow[];
  anomalies: ScanAnomaly[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Read-only scan timeline — SELECT on operational_scan_records only.
 * Finance-release gating anomalies are suppressed until per-order finance facts are wired.
 */
export function useScanTimeline(limit = DEFAULT_LIMIT): ScanTimelineState {
  const [scans, setScans] = useState<OperationalScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await operationalDb
        .from("operational_scan_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (queryError) {
        if (queryError.message.includes("does not exist")) {
          setScans([]);
          return;
        }
        throw new Error(queryError.message);
      }

      setScans(((data ?? []) as ScanRow[]).map(mapScanRow));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scan timeline");
      setScans([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => scans.map(mapToTimelineRow), [scans]);

  const anomalies = useMemo(() => {
    const eventInputs = mapOperationalScansToEventInputs(scans);
    return deriveScanAnomalies(eventInputs, true);
  }, [scans]);

  return { rows, anomalies, loading, error, refresh: load };
}
