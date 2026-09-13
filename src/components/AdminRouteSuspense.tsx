import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";

const LOAD_TIMEOUT_MS = 5_000;

function AdminRouteLoadingFallback() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <h2 className="text-lg font-semibold">This admin screen failed to load</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The module did not finish loading within 5 seconds. Your session and navigation remain active — reload this
          screen to try again.
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Reload screen
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading admin screen">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "#C5A059", borderTopColor: "transparent" }}
      />
    </div>
  );
}

/** Keeps AdminLayout chrome visible while lazy admin child routes load. */
export function AdminRouteSuspense({ children }: { children?: ReactNode }) {
  return <Suspense fallback={<AdminRouteLoadingFallback />}>{children ?? <Outlet />}</Suspense>;
}

export default AdminRouteSuspense;
