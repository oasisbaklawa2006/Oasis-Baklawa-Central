import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  projectCustomerTimelineFromEvents,
  toCustomerTimelinePublicContract,
  type CustomerTimelineProjectionResult,
  type CustomerTimelinePublicContract,
} from "@/lib/customer-timeline";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

const operationalDb = supabase as unknown as SupabaseClient;

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

/**
 * Read-only staff preview — SELECT operational_events by order_id only.
 */
export function useCustomerTimelinePreview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<CustomerTimelineProjectionResult | null>(null);
  const [publicContract, setPublicContract] = useState<CustomerTimelinePublicContract | null>(null);

  const loadByOrderId = useCallback(async (orderId: string, publicOrderRef?: string) => {
    const trimmed = orderId.trim();
    if (!trimmed) {
      setError("Enter an order ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await operationalDb
        .from("operational_events")
        .select("*")
        .eq("order_id", trimmed)
        .order("created_at", { ascending: true })
        .limit(500);
      if (qErr) throw new Error(qErr.message);
      const events = ((data ?? []) as EventRow[]).map(mapEventRow);
      const result = projectCustomerTimelineFromEvents({ orderId: trimmed, events });
      setProjection(result);
      setPublicContract(toCustomerTimelinePublicContract(result, publicOrderRef ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timeline");
      setProjection(null);
      setPublicContract(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, projection, publicContract, loadByOrderId };
}
