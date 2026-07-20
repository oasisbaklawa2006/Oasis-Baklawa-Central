import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OperatorInboxAccountabilityItem {
  item_source: "CURRENT_CAPTURE_EXCEPTION" | "HISTORICAL_RECONCILIATION" | string;
  source_record_id: string;
  source_message_id: string;
  existing_intake_id: string | null;
  provider_message_id: string | null;
  provider: string | null;
  receiver_channel_id: string | null;
  accountability_state: string;
  effective_disposition: string;
  assigned_team: string | null;
  effective_next_action: string | null;
  closure_reason: string | null;
  evidence: Record<string, unknown> | null;
  detected_at: string;
  resolved_at: string | null;
  priority_rank: number;
}

export interface OperatorInboxAccountabilitySummary {
  total: number;
  critical: number;
  unowned: number;
  actionless: number;
  stale: number;
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function summarizeOperatorInboxAccountability(
  items: OperatorInboxAccountabilityItem[],
  nowMs = Date.now(),
): OperatorInboxAccountabilitySummary {
  return items.reduce<OperatorInboxAccountabilitySummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.priority_rank <= 20) summary.critical += 1;
      if (!item.assigned_team?.trim()) summary.unowned += 1;
      if (!item.effective_next_action?.trim()) summary.actionless += 1;
      const detectedAtMs = Date.parse(item.detected_at);
      if (Number.isFinite(detectedAtMs) && nowMs - detectedAtMs >= STALE_AFTER_MS) summary.stale += 1;
      return summary;
    },
    { total: 0, critical: 0, unowned: 0, actionless: 0, stale: 0 },
  );
}

export function useOperatorInboxAccountability(refreshKey: number) {
  const [items, setItems] = useState<OperatorInboxAccountabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    try {
      const { data, error: rpcError } = await (supabase as typeof supabase & {
        rpc: (
          fn: string,
          args: { include_closed: boolean; result_limit: number },
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc("get_whatsapp_authorized_channel_accountability_queue", {
        include_closed: false,
        result_limit: 200,
      });

      if (generation !== loadGenerationRef.current) return;
      if (rpcError) throw new Error(rpcError.message);
      setItems(Array.isArray(data) ? (data as OperatorInboxAccountabilityItem[]) : []);
      setError(null);
    } catch (cause) {
      if (generation !== loadGenerationRef.current) return;
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Failed to load accountability queue");
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const summary = useMemo(() => summarizeOperatorInboxAccountability(items), [items]);

  return { items, summary, loading, error, reload: load };
}
