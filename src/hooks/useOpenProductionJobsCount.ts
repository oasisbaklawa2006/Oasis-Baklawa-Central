import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOpenProductionJobsCount,
  type OpenProductionJobsCountResult,
} from "@/lib/production-jobs/openProductionJobsCount";

const operationalDb = supabase as unknown as SupabaseClient;

/**
 * Authoritative open production_jobs count -- independent of the legacy
 * orders-derived "production" queue feed. See openProductionJobsCount.ts.
 */
export function useOpenProductionJobsCount() {
  const [result, setResult] = useState<OpenProductionJobsCountResult>({ count: null, error: null });
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOpenProductionJobsCount(operationalDb).then((res) => {
      if (!cancelled) {
        setResult(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return { ...result, loading, refresh: () => setRefreshToken((t) => t + 1) };
}
