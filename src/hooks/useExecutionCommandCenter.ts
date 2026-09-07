import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mapScanRow, type ScanRow } from "@/lib/barcode-execution/barcodeExecutionTypes";
import {
  buildExecutionCommandCenterProjection,
  type ExecutionCommandCenterProjection,
  type ExecutionIntelligenceInput,
} from "@/lib/execution-intelligence";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import { useOperationalLiveFeeds } from "@/hooks/useOperationalLiveFeeds";
import {
  fetchCanonicalDepartmentQueueItems,
  toExecutionIntelligenceQueueItems,
} from "@/lib/department-queues";

type EventRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  order_id: string | null;
  customer_id: string | null;
  queue_item_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  visibility: string;
  severity: string;
  title: string;
  message: string | null;
  reason_code: string | null;
  reason_text: string | null;
  metadata: Record<string, unknown>;
  correlation_id: string;
  idempotency_key: string | null;
  created_at: string;
};

function mapEventRow(row: EventRow): OperationalStoreEventRecord {
  return {
    id: row.id,
    eventType: row.event_type as OperationalStoreEventRecord["eventType"],
    entityType: row.entity_type,
    entityId: row.entity_id,
    orderId: row.order_id,
    customerId: row.customer_id,
    queueItemId: row.queue_item_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    visibility: row.visibility as OperationalStoreEventRecord["visibility"],
    severity: row.severity as OperationalStoreEventRecord["severity"],
    title: row.title,
    message: row.message,
    reasonCode: row.reason_code,
    reasonText: row.reason_text,
    metadata: row.metadata ?? {},
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

/** Client cast until generated types include Phase 3A/3C operational tables. */
const operationalDb = supabase as unknown as SupabaseClient;

/**
 * Read-only Execution Command Center data — SELECT only, no mutations.
 */
export function useExecutionCommandCenter() {
  const { feeds, loading: feedsLoading, error: feedsError, refresh: refreshFeeds } = useOperationalLiveFeeds();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<ExecutionCommandCenterProjection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nowIso = new Date().toISOString();
    try {
      const [canonicalQueueRes, eventRes, scanRes] = await Promise.all([
        fetchCanonicalDepartmentQueueItems(operationalDb, { perLaneLimit: 150 }),
        operationalDb
          .from("operational_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        operationalDb
          .from("operational_scan_records")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (eventRes.error && !eventRes.error.message.includes("does not exist")) {
        throw new Error(eventRes.error.message);
      }
      if (scanRes.error && !scanRes.error.message.includes("does not exist")) {
        throw new Error(scanRes.error.message);
      }

      const queueItems = toExecutionIntelligenceQueueItems(canonicalQueueRes.items);
      const events = ((eventRes.data ?? []) as EventRow[]).map(mapEventRow);
      const scans = ((scanRes.data ?? []) as ScanRow[]).map(mapScanRow);

      const input: ExecutionIntelligenceInput = {
        nowIso,
        queueItems,
        events,
        scans,
        liveFeedSnapshots: feeds?.snapshots,
      };

      setProjection(buildExecutionCommandCenterProjection(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load execution intelligence");
      if (feeds) {
        const fallback: ExecutionIntelligenceInput = {
          nowIso,
          queueItems: [],
          events: [],
          scans: [],
          liveFeedSnapshots: feeds.snapshots,
        };
        setProjection(buildExecutionCommandCenterProjection(fallback));
      }
    } finally {
      setLoading(false);
    }
  }, [feeds]);

  useEffect(() => {
    if (!feedsLoading) void load();
  }, [load, feedsLoading]);

  const refresh = useCallback(() => {
    refreshFeeds();
    void load();
  }, [load, refreshFeeds]);

  const combinedError = error ?? feedsError;

  return useMemo(
    () => ({
      loading: loading || feedsLoading,
      error: combinedError,
      projection,
      refresh,
      feeds,
    }),
    [loading, feedsLoading, combinedError, projection, refresh, feeds],
  );
}
