import { useCallback, useEffect, useState } from "react";
import { subHours } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsSupplementSnapshot {
  messagesLast24h: number | null;
  messagesPrev24h: number | null;
  globalFailedOutboundSample: { provider: string | null; status: string | null; failure_reason: string | null }[];
  lastUpdated: string | null;
  partialErrors: string[];
}

const empty: AnalyticsSupplementSnapshot = {
  messagesLast24h: null,
  messagesPrev24h: null,
  globalFailedOutboundSample: [],
  lastUpdated: null,
  partialErrors: [],
};

/**
 * Extra read-only aggregates beyond the loaded packet window (soft-fail each query).
 * Deferred with setTimeout(0) so it never blocks the inbox paint path.
 */
export function useOperatorInboxAnalyticsSupplement(refreshKey: number) {
  const [snapshot, setSnapshot] = useState<AnalyticsSupplementSnapshot>(empty);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const partialErrors: string[] = [];
    const next: AnalyticsSupplementSnapshot = {
      ...empty,
      partialErrors,
      lastUpdated: new Date().toISOString(),
    };

    const now = new Date();
    const t24 = subHours(now, 24).toISOString();
    const t48 = subHours(now, 48).toISOString();

    const safeCount = async (
      label: string,
      fn: () => Promise<{ count: number | null; error: { message: string } | null }>,
    ) => {
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

    next.messagesLast24h = await safeCount("messages last 24h", async () => {
      const r = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", t24);
      return { count: r.count, error: r.error };
    });

    next.messagesPrev24h = await safeCount("messages prev 24h", async () => {
      const r = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", t48)
        .lt("created_at", t24);
      return { count: r.count, error: r.error };
    });

    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select("provider, status, failure_reason")
        .eq("direction", "outbound")
        .in("status", ["failed", "error"])
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) partialErrors.push(`failed outbound sample: ${error.message}`);
      else {
        next.globalFailedOutboundSample = (data ?? []) as unknown as AnalyticsSupplementSnapshot["globalFailedOutboundSample"];
      }
    } catch (e) {
      partialErrors.push(`failed outbound sample: ${e instanceof Error ? e.message : String(e)}`);
    }

    next.partialErrors = partialErrors;
    setSnapshot(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load, refreshKey]);

  return { snapshot, loading };
}
