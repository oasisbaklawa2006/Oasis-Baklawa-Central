import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { reconcileOperatorWorkspaceCaches } from "./operatorInboxWorkspaceHydration";
import {
  fetchOperatorWorkspaceServerSnapshot,
  persistOperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceServer";
import {
  OPERATOR_WORKSPACE_MUTATION_EVENT,
  loadPendingOperatorWorkspaceMutations,
  removePendingOperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceMutations";

const RETRY_MS = 30_000;

export function OperatorInboxWorkspacePersistenceGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      for (const mutation of loadPendingOperatorWorkspaceMutations()) {
        try {
          await persistOperatorWorkspaceMutation(mutation);
          removePendingOperatorWorkspaceMutation(mutation.id);
          setSyncError(null);
        } catch (caught) {
          setSyncError(caught instanceof Error ? caught.message : "Operator workspace sync failed");
          break;
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchOperatorWorkspaceServerSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        reconcileOperatorWorkspaceCaches(snapshot, loadPendingOperatorWorkspaceMutations());
        setSyncError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        setSyncError(caught instanceof Error ? caught.message : "Operator workspace hydration failed");
      })
      .finally(() => {
        if (cancelled) return;
        setReady(true);
        void processQueue();
      });
    return () => {
      cancelled = true;
    };
  }, [processQueue]);

  useEffect(() => {
    const triggerSync = () => void processQueue();
    window.addEventListener(OPERATOR_WORKSPACE_MUTATION_EVENT, triggerSync);
    window.addEventListener("online", triggerSync);
    const timer = window.setInterval(triggerSync, RETRY_MS);
    return () => {
      window.removeEventListener(OPERATOR_WORKSPACE_MUTATION_EVENT, triggerSync);
      window.removeEventListener("online", triggerSync);
      window.clearInterval(timer);
    };
  }, [processQueue]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50" role="status">
        <p className="text-sm text-gray-600">Loading governed WhatsApp operator workspace…</p>
      </div>
    );
  }

  return (
    <>
      {syncError ? (
        <div className="fixed inset-x-0 top-0 z-[100] border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-950" role="status">
          Operator workspace changes are queued for governed retry: {syncError}
        </div>
      ) : null}
      {children}
    </>
  );
}
