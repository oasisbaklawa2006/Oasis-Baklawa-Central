import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatFinanceControlPrerequisite,
  probeFinanceControlAuthority,
  type Point80RequiredCoreRpc,
} from "@/lib/order-authority/financeHoldReleaseAuthorityClient";

export type Point80ControlPersistenceMode = "core" | "demo" | "blocked";

export interface Point80ControlBoundaryState {
  persistenceMode: Point80ControlPersistenceMode;
  canExecuteTypedWrites: boolean;
  missingCoreRpcs: Point80RequiredCoreRpc[];
  prerequisiteMessage: string | null;
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function resolvePoint80ControlBoundary(
  _client?: SupabaseClient,
  options?: { forceDemo?: boolean },
): Promise<Point80ControlBoundaryState> {
  if (options?.forceDemo || isTestMode()) {
    return {
      persistenceMode: "demo",
      canExecuteTypedWrites: isTestMode(),
      missingCoreRpcs: [],
      prerequisiteMessage: null,
    };
  }

  const probe = await probeFinanceControlAuthority().catch(() => ({
    available: false,
    missingCoreRpcs: [] as Point80RequiredCoreRpc[],
  }));

  if (probe.available) {
    return {
      persistenceMode: "core",
      canExecuteTypedWrites: true,
      missingCoreRpcs: [],
      prerequisiteMessage: null,
    };
  }

  return {
    persistenceMode: "blocked",
    canExecuteTypedWrites: false,
    missingCoreRpcs: probe.missingCoreRpcs,
    prerequisiteMessage: formatFinanceControlPrerequisite(probe.missingCoreRpcs),
  };
}
