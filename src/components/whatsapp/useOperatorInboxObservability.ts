import { useCallback, useEffect, useRef, useState } from "react";
import { startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { aggregateProviderCounts, stitchedContentLooksClassified } from "./operatorInboxUtils";

export interface OperatorInboxObservabilitySnapshot {
  messagesVolumeToday: number | null;
  openPacketsPending: number | null;
  classifiedPacketsSample: number | null;
  unclassifiedPacketsSample: number | null;
  failedOperatorReplies: number | null;
  providerDistributionToday: { provider: string; count: number }[];
  lastUpdated: string | null;
  partialErrors: string[];
}

const emptySnapshot: OperatorInboxObservabilitySnapshot = {
  messagesVolumeToday: null,
  openPacketsPending: null,
  classifiedPacketsSample: null,
  unclassifiedPacketsSample: null,
  failedOperatorReplies: null,
  providerDistributionToday: [],
  lastUpdated: null,
  partialErrors: [],
};

/**
 * Read-only Supabase aggregates for operator observability (no writes).
 * Individual query failures are captured in partialErrors so the inbox still loads.
 */
export function useOperatorInboxObservability(refreshKey: number) {
  const [snapshot, setSnapshot] = useState<OperatorInboxObservabilitySnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  /** After first successful observability fetch, `refreshKey`-driven reloads skip the loading spinner (no UI flicker). */
  const observabilityHasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    const partialErrors: string[] = [];
    const dayStart = startOfDay(new Date()).toISOString();

    const next: OperatorInboxObservabilitySnapshot = {
      ...emptySnapshot,
      partialErrors,
      lastUpdated: new Date().toISOString(),
    };

    const safeCount = async (label: string, fn: () => Promise<{ count: number | null; error: Error | null }>) => {
      try {
        const { count, error } = await fn();
        if (error) {
          partialErrors.push(`${label}: ${error.message}`);
          return null;
        }
        return count ?? null;
      } catch (e) {
        partialErrors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    };

    next.messagesVolumeToday = await safeCount("messages today", async () => {
      const r = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart);
      return { count: r.count, error: r.error as Error | null };
    });

    next.openPacketsPending = await safeCount("open packets", async () => {
      const r = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_message_packets" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      return { count: r.count, error: r.error as Error | null };
    });

    next.failedOperatorReplies = await safeCount("failed operator replies", async () => {
      const r = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("direction", "outbound")
        .eq("provider", "operator_reply")
        .in("status", ["failed", "error"]);
      return { count: r.count, error: r.error as Error | null };
    });

    try {
      const { data: sampleRows, error: sampleErr } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_message_packets" as any)
        .select("stitched_content")
        .eq("status", "open")
        .order("last_message_at", { ascending: false })
        .limit(80);

      if (sampleErr) {
        partialErrors.push(`classification sample: ${sampleErr.message}`);
      } else {
        const rows = (sampleRows ?? []) as { stitched_content?: unknown }[];
        let classified = 0;
        for (const row of rows) {
          if (stitchedContentLooksClassified(row.stitched_content)) classified += 1;
        }
        next.classifiedPacketsSample = classified;
        next.unclassifiedPacketsSample = rows.length - classified;
      }
    } catch (e) {
      partialErrors.push(`classification sample: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const { data: provRows, error: provErr } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select("provider")
        .gte("created_at", dayStart)
        .limit(2000);

      if (provErr) {
        partialErrors.push(`provider sample: ${provErr.message}`);
      } else {
        next.providerDistributionToday = aggregateProviderCounts(
          (provRows ?? []) as { provider?: string | null }[],
        );
      }
    } catch (e) {
      partialErrors.push(`provider sample: ${e instanceof Error ? e.message : String(e)}`);
    }

    next.partialErrors = partialErrors;
    setSnapshot(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!observabilityHasLoadedOnceRef.current) {
      setLoading(true);
    }
    void load().finally(() => {
      observabilityHasLoadedOnceRef.current = true;
    });
  }, [load, refreshKey]);

  return { snapshot, loading, reload: load };
}
