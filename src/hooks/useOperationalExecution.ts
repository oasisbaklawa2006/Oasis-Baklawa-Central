import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  createSupabaseOperationalExecutionBundle,
  type OperationalExecutionContext,
  type OperationalExecutionService,
  type OperationalQueueReadStore,
  OperationalExecutionError,
} from "@/lib/operational-execution";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";

const PREVIEW_WRITE_ROLES = new Set(["SUPER_ADMIN", "OPERATIONS_MANAGER"]);

export function useOperationalExecution() {
  const { user, role } = useAuth();
  const bundle = useMemo(() => createSupabaseOperationalExecutionBundle(supabase), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MappedQueueItem[]>([]);

  const canWrite = Boolean(role && PREVIEW_WRITE_ROLES.has(role.trim().toUpperCase()));

  const executionContext = useMemo((): OperationalExecutionContext | null => {
    if (!user?.id || !role) return null;
    return {
      correlationId: crypto.randomUUID(),
      actorUserId: user.id,
      actorRole: role,
    };
  }, [user?.id, role]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const open = await bundle.read.listOpenQueueItems({ limit: 50 });
      setItems(open);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue items");
    } finally {
      setLoading(false);
    }
  }, [bundle.read]);

  const runWrite = useCallback(
    async <T>(fn: (svc: OperationalExecutionService, ctx: OperationalExecutionContext) => Promise<T>) => {
      if (!canWrite || !executionContext) {
        setError("Write actions require SUPER_ADMIN or OPERATIONS_MANAGER");
        return null;
      }
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    },
    [bundle.execution, canWrite, executionContext, refresh],
  );

  return {
    loading,
    error,
    items,
    canWrite,
    refresh,
    runWrite,
    read: bundle.read as OperationalQueueReadStore,
    execution: bundle.execution,
  };
}
