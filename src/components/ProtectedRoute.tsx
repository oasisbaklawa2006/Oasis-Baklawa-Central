import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const PROFILE_BOOTSTRAP_TIMEOUT_MS = 5_000;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading, profileReady, isAuthenticated } = useAuth();
  const [bootstrapWaitExpired, setBootstrapWaitExpired] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootstrapWaitExpired(true), PROFILE_BOOTSTRAP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const waitingOnProfile = isAuthenticated && !profileReady && !bootstrapWaitExpired;

  if (loading || waitingOnProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#C5A059", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
