import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBarcodeExecutionBundle } from "@/lib/barcode-execution";
import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";
import {
  canExecuteOnBoard,
  filterBoardEvents,
  getDepartmentBoard,
  projectExecutionBoardLanes,
  type DepartmentBoardId,
  type ExecutionBoardLanes,
} from "@/lib/execution-boards";
import {
  buildOperationalPhotoMetadata,
  formatPhotoNoteLine,
  photoMetadataForEvent,
} from "@/lib/operational-media";
import {
  createSupabaseOperationalExecutionBundle,
  OperationalExecutionError,
  type OperationalExecutionContext,
  type OperationalExecutionService,
} from "@/lib/operational-execution";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mapScanRow, type ScanRow } from "@/lib/barcode-execution/barcodeExecutionTypes";

const operationalDb = supabase as unknown as SupabaseClient;

const POLL_MS = 45_000;

export function useDepartmentExecutionBoard(boardId: DepartmentBoardId) {
  const config = getDepartmentBoard(boardId);
  const { user, role } = useAuth();
  const bundle = useMemo(() => createSupabaseOperationalExecutionBundle(supabase), []);
  const scanBundle = useMemo(() => createSupabaseBarcodeExecutionBundle(supabase), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MappedQueueItem[]>([]);
  const [scans, setScans] = useState<OperationalScanRecord[]>([]);
  const [events, setEvents] = useState<OperationalStoreEventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canWrite = canExecuteOnBoard(role, config.queueTypes);

  const executionContext = useMemo((): OperationalExecutionContext | null => {
    if (!user?.id || !role) return null;
    return {
      correlationId: crypto.randomUUID(),
      actorUserId: user.id,
      actorRole: role,
      actorDepartment: config.ownerDepartment,
    };
  }, [user?.id, role, config.ownerDepartment]);

  const lanes: ExecutionBoardLanes = useMemo(() => {
    const nowIso = new Date().toISOString();
    return projectExecutionBoardLanes(items, config, nowIso, scans);
  }, [items, config, scans]);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const drawerEvents = useMemo(() => {
    if (!selectedItem) return [];
    return filterBoardEvents(events, selectedItem.id, selectedItem.entityId);
  }, [events, selectedItem]);

  const drawerScans = useMemo(() => {
    if (!selectedItem) return [];
    return scans.filter((s) => s.entityId === selectedItem.entityId || s.queueItemId === selectedItem.id);
  }, [scans, selectedItem]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await bundle.read.listDepartmentQueueItems({
        queueTypes: config.queueTypes,
        includeCompletedToday: true,
        limit: 200,
      });
      setItems(list);

      const { data: scanData, error: scanErr } = await operationalDb
        .from("operational_scan_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150);
      if (scanErr && !scanErr.message.includes("does not exist")) throw new Error(scanErr.message);
      setScans(((scanData ?? []) as ScanRow[]).map(mapScanRow));

      const { data: eventData, error: eventErr } = await operationalDb
        .from("operational_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);
      if (eventErr && !eventErr.message.includes("does not exist")) throw new Error(eventErr.message);
      setEvents(
        ((eventData ?? []) as Record<string, unknown>[]).map((row) => ({
          id: row.id as string,
          eventType: row.event_type as OperationalStoreEventRecord["eventType"],
          entityType: row.entity_type as string,
          entityId: row.entity_id as string,
          orderId: (row.order_id as string) ?? null,
          customerId: (row.customer_id as string) ?? null,
          queueItemId: (row.queue_item_id as string) ?? null,
          actorId: (row.actor_id as string) ?? null,
          actorRole: (row.actor_role as string) ?? null,
          actorDepartment: (row.actor_department as string) ?? null,
          visibility: (row.visibility as OperationalStoreEventRecord["visibility"]) ?? "internal",
          severity: (row.severity as OperationalStoreEventRecord["severity"]) ?? "info",
          title: row.title as string,
          message: (row.message as string) ?? null,
          reasonCode: (row.reason_code as string) ?? null,
          reasonText: (row.reason_text as string) ?? null,
          metadata: (row.metadata as Record<string, unknown>) ?? {},
          correlationId: row.correlation_id as string,
          idempotencyKey: (row.idempotency_key as string) ?? null,
          createdAt: row.created_at as string,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [bundle.read, config.queueTypes]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const runWrite = useCallback(
    async <T>(
      fn: (
        exec: OperationalExecutionService,
        ctx: OperationalExecutionContext,
      ) => Promise<T>,
    ) => {
      if (!canWrite || !executionContext) {
        setError("You do not have authority to execute actions on this board");
        return null;
      }
      setError(null);
      try {
        const result = await fn(bundle.execution, {
          ...executionContext,
          correlationId: crypto.randomUUID(),
        });
        await refresh();
        return result;
      } catch (e) {
        const msg =
          e instanceof OperationalExecutionError
            ? `[${e.code}] ${e.message}`
            : e instanceof Error
              ? e.message
              : "Action failed";
        setError(msg);
        return null;
      }
    },
    [bundle.execution, canWrite, executionContext, refresh],
  );

  const runScan = useCallback(
    async (
      kind: "carton" | "gate" | "handoff" | "intake" | "order",
      item: MappedQueueItem,
      barcodeValue: string,
      expectedBarcode: string,
      extra?: { gateId?: string; fromDepartment?: string; toDepartment?: string },
    ) => {
      if (!executionContext) return null;
      const ctx = { ...executionContext, correlationId: crypto.randomUUID() };
      try {
        const base = {
          entityType: item.entityType,
          entityId: item.entityId,
          orderId: item.orderId,
          queueItemId: item.id,
          barcodeValue,
          expectedBarcode,
        };
        let result;
        if (kind === "gate") {
          result = await scanBundle.execution.verifyDispatchGateScan(
            { ...base, gateId: extra?.gateId ?? "default-gate" },
            ctx,
          );
        } else if (kind === "handoff") {
          result = await scanBundle.execution.verifyDepartmentHandoff(
            {
              ...base,
              fromDepartment: extra?.fromDepartment ?? config.ownerDepartment,
              toDepartment: extra?.toDepartment ?? "downstream",
              expectedBarcode,
            },
            ctx,
          );
        } else if (kind === "intake") {
          result = await scanBundle.execution.verifyReadyGoodsIntake(base, ctx);
        } else if (kind === "carton") {
          result = await scanBundle.execution.verifyCartonBarcode(base, ctx);
        } else {
          result = await scanBundle.execution.verifyOrderBarcode(base, ctx);
        }
        await refresh();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scan failed");
        return null;
      }
    },
    [scanBundle.execution, executionContext, config.ownerDepartment, refresh],
  );

  const attachPhoto = useCallback(
    async (item: MappedQueueItem, imageReference: string, caption?: string) => {
      if (!executionContext || !user?.id) return null;
      const meta = buildOperationalPhotoMetadata({
        imageReference,
        caption,
        queueItemId: item.id,
        department: config.ownerDepartment,
        actorUserId: user.id,
      });
      return runWrite((exec, ctx) =>
        exec.addOperationalNote(
          {
            queueItemId: item.id,
            note: formatPhotoNoteLine(meta),
            metadata: photoMetadataForEvent(meta),
          },
          ctx,
        ),
      );
    },
    [config.ownerDepartment, executionContext, runWrite, user?.id],
  );

  return {
    config,
    loading,
    error,
    lanes,
    items,
    scans,
    events,
    selectedId,
    setSelectedId,
    selectedItem,
    drawerEvents,
    drawerScans,
    canWrite,
    refresh,
    runWrite,
    runScan,
    attachPhoto,
    execution: bundle.execution,
  };
}
