import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const PROFILE_BOOTSTRAP_TIMEOUT_MS = 5_000;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading, profileReady, isAuthenticated, refreshProfile } = useAuth();
  const [bootstrapTimedOut, setBootstrapTimedOut] = useState(false);
  const [bootstrapRetryAttempt, setBootstrapRetryAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || profileReady) {
      setBootstrapTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setBootstrapTimedOut(true), PROFILE_BOOTSTRAP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [bootstrapRetryAttempt, isAuthenticated, profileReady]);

  if (!isAuthenticated) {
    if (loading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "#C5A059", borderTopColor: "transparent" }}
          />
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  if (!profileReady) {
    if (bootstrapTimedOut) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center"
          role="alert"
          data-testid="protected-route-bootstrap-timeout"
        >
          <h2 className="text-lg font-semibold">Session profile could not be verified</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Your sign-in is active, but role and access checks did not finish within 5 seconds. Protected admin
            content stays hidden until profile resolution succeeds.
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              setBootstrapTimedOut(false);
              setBootstrapRetryAttempt((attempt) => attempt + 1);
              void refreshProfile({ method: "session_restore", forceRefresh: true });
            }}
          >
            Retry profile check
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Verifying session profile">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#C5A059", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#C5A059", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
