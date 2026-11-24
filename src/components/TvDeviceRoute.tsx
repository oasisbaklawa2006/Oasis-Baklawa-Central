import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, MonitorOff } from "lucide-react";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRole } from "@/lib/auth-routing";
import {
  TV_DEVICE_ROLES,
  TvDeviceSessionContext,
  fetchTvDeviceStatus,
  isTvDeviceRole,
  type TvGroup,
  type TvRpcClient,
  type TvDeviceStatusResult,
} from "@/lib/tvDevice";

const POLL_MS = 60_000;

interface Props {
  group: TvGroup;
  /** Existing staff roles for this wall display. Staff behaviour is unchanged. */
  staffRoles: string[];
  children: ReactNode;
  /** Test seam only. */
  client?: TvRpcClient;
}

const BLOCK_COPY: Record<Exclude<TvDeviceStatusResult, "ACTIVE">, string> = {
  NOT_REGISTERED: "This display is not registered as a TV device. Ask an administrator to register it.",
  DISABLED: "This display has been disabled by an administrator.",
  REVOKED: "This display's access has been revoked.",
  GROUP_MISMATCH: "This display is registered for a different department screen.",
  UNAVAILABLE: "Display access could not be verified. Nothing is shown until it can.",
};

function TvDeviceStatusGate({ group, children, client }: Pick<Props, "group" | "children" | "client">) {
  const [status, setStatus] = useState<TvDeviceStatusResult | "CHECKING">("CHECKING");
  const rpcClient = client ?? (supabase as unknown as TvRpcClient);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await fetchTvDeviceStatus(rpcClient, group);
      if (!cancelled) setStatus(next);
    };
    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [group, rpcClient]);

  if (status === "CHECKING") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900" data-testid="tv-device-checking">
        <Loader2 size={64} className="animate-spin text-emerald-400" />
      </div>
    );
  }
  if (status !== "ACTIVE") {
    const Icon = status === "UNAVAILABLE" ? AlertTriangle : MonitorOff;
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-gray-900 px-8 text-center text-white"
        data-testid="tv-device-blocked"
        data-tv-device-status={status}
      >
        <Icon size={64} className="text-red-500" />
        <p className="text-2xl font-bold">Display not authorised</p>
        <p className="max-w-xl text-gray-400">{BLOCK_COPY[status]}</p>
      </div>
    );
  }
  return <TvDeviceSessionContext.Provider value>{children}</TvDeviceSessionContext.Provider>;
}

/**
 * Guard for the six department wall displays. Staff roles pass exactly as before (RoleProtectedRoute). A TV device
 * account is allowed only while Core reports its own device ACTIVE for THIS route's group; a TV role alone is never
 * enough, and a failed or unrecognised status fails closed.
 */
export default function TvDeviceRoute({ group, staffRoles, children, client }: Props) {
  const { role } = useAuth();
  if (isTvDeviceRole(normalizeRole(role))) {
    return (
      <RoleProtectedRoute allowedRoles={[...TV_DEVICE_ROLES]}>
        <TvDeviceStatusGate group={group} client={client}>
          {children}
        </TvDeviceStatusGate>
      </RoleProtectedRoute>
    );
  }
  return <RoleProtectedRoute allowedRoles={staffRoles}>{children}</RoleProtectedRoute>;
}
