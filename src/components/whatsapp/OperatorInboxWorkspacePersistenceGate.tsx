import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { reconcileOperatorWorkspaceCaches } from "./operatorInboxWorkspaceHydration";
import {
  fetchOperatorWorkspaceServerSnapshot,
  persistOperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceServer";
import {
  OPERATOR_WORKSPACE_MUTATION_EVENT,
  OPERATOR_WORKSPACE_SYNC_ERROR_EVENT,
  loadPendingOperatorWorkspaceMutations,
  removePendingOperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceMutations";

const RETRY_MS = 30_000;
const HYDRATION_TIMEOUT_MS = 12_000;

export function OperatorInboxWorkspacePersistenceGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const hydratingRef = useRef(false);
  const mountedRef = useRef(true);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      for (const mutation of loadPendingOperatorWorkspaceMutations()) {
        try {
          await persistOperatorWorkspaceMutation(mutation);
          removePendingOperatorWorkspaceMutation(mutation.id);
          if (mountedRef.current) setSyncError(null);
        } catch (caught) {
          if (mountedRef.current) {
            setSyncError(caught instanceof Error ? caught.message : "Operator workspace sync failed");
          }
          break;
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  const hydrateWorkspace = useCallback(async () => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, HYDRATION_TIMEOUT_MS);
    const timeout = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new Error("WA_OPERATOR_WORKSPACE_HYDRATION_TIMEOUT")),
        { once: true },
      );
    });
    try {
      const snapshot = await Promise.race([
        fetchOperatorWorkspaceServerSnapshot(controller.signal),
        timeout,
      ]);
      if (!mountedRef.current) return;
      reconcileOperatorWorkspaceCaches(snapshot, loadPendingOperatorWorkspaceMutations());
      setReady(true);
      setSyncError(null);
    } catch (caught) {
      if (!mountedRef.current) return;
      setSyncError(caught instanceof Error ? caught.message : "Operator workspace hydration failed");
    } finally {
      window.clearTimeout(timeoutId);
      hydratingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void hydrateWorkspace().then(() => processQueue());
    return () => {
      mountedRef.current = false;
    };
  }, [hydrateWorkspace, processQueue]);

  useEffect(() => {
    const triggerSync = () => {
      void hydrateWorkspace();
      void processQueue();
    };
    const reportQueueError = (event: Event) => {
      const { message } = (event as CustomEvent<{ message?: string }>).detail;
      setSyncError(message ?? "Operator workspace queue requires synchronization");
    };

    window.addEventListener(OPERATOR_WORKSPACE_MUTATION_EVENT, triggerSync);
    window.addEventListener(OPERATOR_WORKSPACE_SYNC_ERROR_EVENT, reportQueueError);
    window.addEventListener("online", triggerSync);
    const timer = window.setInterval(triggerSync, RETRY_MS);
    return () => {
      window.removeEventListener(OPERATOR_WORKSPACE_MUTATION_EVENT, triggerSync);
      window.removeEventListener(OPERATOR_WORKSPACE_SYNC_ERROR_EVENT, reportQueueError);
      window.removeEventListener("online", triggerSync);
      window.clearInterval(timer);
    };
  }, [hydrateWorkspace, processQueue]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6 text-center" role="status">
        <div>
          <p className="text-sm text-gray-600">Loading governed WhatsApp operator workspace…</p>
          {syncError ? (
            <p className="mt-2 text-xs text-amber-800">
              {syncError}. Automatic retry runs when connectivity returns and every 30 seconds.
            </p>
          ) : null}
        </div>
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
