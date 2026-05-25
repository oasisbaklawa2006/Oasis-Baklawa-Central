import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createFallbackSearchIndexRepository,
  createSupabaseSearchIndexRepository,
} from "@/lib/operational-search/supabaseSearchIndexRepository";
import type {
  OperationalSearchIndexQuery,
  OperationalSearchIndexQueryResult,
  SearchAuthorityContext,
  SearchIndexEntityType,
} from "@/lib/operational-search/searchIndexTypes";
import { useAuth } from "@/hooks/useAuth";

function defaultAuthority(role: string | undefined): SearchAuthorityContext {
  const r = role ?? "STAFF";
  const cmd = r === "SUPER_ADMIN" || r === "OPERATIONS_MANAGER";
  return {
    role: r,
    departments: [],
    canViewConfidential: cmd,
    canViewRestricted: cmd || r.includes("MANAGER") || r.includes("EXECUTIVE"),
  };
}

export function useOperationalGlobalSearch() {
  const { role } = useAuth();
  const authority = useMemo(() => defaultAuthority(role ?? undefined), [role]);

  const repository = useMemo(() => {
    try {
      return createSupabaseSearchIndexRepository(supabase);
    } catch {
      return createFallbackSearchIndexRepository();
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperationalSearchIndexQueryResult | null>(null);

  const search = useCallback(
    async (query: OperationalSearchIndexQuery) => {
      if (!query.text.trim()) {
        setResult(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await repository.searchOperationalIndex(query, authority);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [repository, authority],
  );

  return {
    loading,
    error,
    result,
    authority,
    search,
    entityTypes: [
      "order",
      "queue_item",
      "operational_event",
      "scan_record",
      "customer",
      "complaint",
      "dispatch_reference",
      "carton",
    ] as SearchIndexEntityType[],
  };
}
