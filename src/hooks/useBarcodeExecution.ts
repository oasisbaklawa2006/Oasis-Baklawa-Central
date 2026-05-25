import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  createSupabaseBarcodeExecutionBundle,
  type OperationalScanRecord,
  type ScanExecutionContext,
} from "@/lib/barcode-execution";

const PREVIEW_WRITE_ROLES = new Set([
  "SUPER_ADMIN",
  "OPERATIONS_MANAGER",
  "DISPATCH_MANAGER",
  "DISPATCH_HEAD",
  "PRODUCTION_MANAGER",
]);

export function useBarcodeExecution() {
  const { user, role } = useAuth();
  const bundle = useMemo(() => createSupabaseBarcodeExecutionBundle(supabase), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scans, setScans] = useState<OperationalScanRecord[]>([]);

  const canWrite = Boolean(role && PREVIEW_WRITE_ROLES.has(role.trim().toUpperCase()));

  const executionContext = useMemo((): ScanExecutionContext | null => {
    if (!user?.id || !role) return null;
    return {
      correlationId: crypto.randomUUID(),
      actorUserId: user.id,
      actorRole: role,
      scanSource: "admin_preview",
    };
  }, [user?.id, role]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await bundle.scans.listRecentScans(40);
      setScans(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scans");
    } finally {
      setLoading(false);
    }
  }, [bundle.scans]);

  const runVerifySample = useCallback(async () => {
    if (!canWrite || !executionContext) {
      setError("Write actions require an authorized operations or dispatch role");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const entityId = crypto.randomUUID();
      await bundle.execution.verifyOrderBarcode(
        {
          entityType: "order",
          entityId,
          barcodeValue: `PREVIEW-${Date.now()}`,
          expectedBarcode: `PREVIEW-${Date.now()}`,
        },
        { ...executionContext, correlationId: crypto.randomUUID() },
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [bundle.execution, canWrite, executionContext, refresh]);

  const mismatchAlerts = useMemo(
    () => scans.filter((s) => s.verificationStatus === "mismatch" || s.verificationStatus === "rejected"),
    [scans],
  );
  const duplicateAlerts = useMemo(
    () => scans.filter((s) => s.verificationStatus === "duplicate"),
    [scans],
  );

  return {
    loading,
    error,
    scans,
    mismatchAlerts,
    duplicateAlerts,
    canWrite,
    refresh,
    runVerifySample,
    events: bundle.events,
  };
}
