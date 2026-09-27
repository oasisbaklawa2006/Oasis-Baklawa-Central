import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePoint80ControlBoundary } from "@/lib/order-authority/financeControlBoundary";
import { createFinanceGovernanceService, createInMemoryFinanceEventSink } from "./financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "./inMemoryFinanceEvidenceStore";
import {
  createSupabaseFinanceEvidenceStore,
  probeFinanceEvidenceTable,
} from "./supabaseFinanceEvidenceStore";

export type FinanceGovernancePersistenceMode = "supabase" | "demo" | "unavailable";

export interface FinanceGovernanceBundle {
  service: ReturnType<typeof createFinanceGovernanceService>;
  persistenceMode: FinanceGovernancePersistenceMode;
  canExecuteWrites: boolean;
  /** Golden Chain commercial_release shadow writes to finance_review_evidence. */
  canExecuteCommercialRelease: boolean;
  corePrerequisiteMessage: string | null;
  point80ControlMode: "core" | "demo" | "blocked";
}

function isTestMode(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}

export async function createFinanceGovernanceBundle(
  client?: SupabaseClient,
  options?: { forceInMemory?: boolean },
): Promise<FinanceGovernanceBundle> {
  const events = createInMemoryFinanceEventSink();
  const controlBoundary = await resolvePoint80ControlBoundary(client, {
    forceDemo: options?.forceInMemory,
  });

  const service = createFinanceGovernanceService({
    evidence: createInMemoryFinanceEvidenceStore(),
    events,
    controlMode: controlBoundary.persistenceMode,
  });

  if (options?.forceInMemory || controlBoundary.persistenceMode === "demo") {
    return {
      service,
      persistenceMode: "demo",
      canExecuteWrites: isTestMode(),
      canExecuteCommercialRelease: isTestMode(),
      corePrerequisiteMessage: null,
      point80ControlMode: controlBoundary.persistenceMode,
    };
  }

  if (!client) {
    return {
      service,
      persistenceMode: "unavailable",
      canExecuteWrites: false,
      canExecuteCommercialRelease: false,
      corePrerequisiteMessage: controlBoundary.prerequisiteMessage,
      point80ControlMode: controlBoundary.persistenceMode,
    };
  }

  const evidenceTableOk = await probeFinanceEvidenceTable(client).catch(() => false);
  if (!evidenceTableOk) {
    return {
      service,
      persistenceMode: "unavailable",
      canExecuteWrites: false,
      canExecuteCommercialRelease: false,
      corePrerequisiteMessage:
        controlBoundary.prerequisiteMessage ??
        "Core finance control authority unavailable — Central must not write finance_review_evidence directly.",
      point80ControlMode: controlBoundary.persistenceMode === "core" ? "core" : "blocked",
    };
  }

  const typedControlOk = controlBoundary.persistenceMode === "core";
  const serviceControlMode = typedControlOk ? "core" : "shadow";

  return {
    service: createFinanceGovernanceService({
      evidence: createSupabaseFinanceEvidenceStore(client),
      events,
      controlMode: serviceControlMode,
    }),
    persistenceMode: "supabase",
    canExecuteWrites: typedControlOk,
    canExecuteCommercialRelease: true,
    corePrerequisiteMessage: typedControlOk ? null : controlBoundary.prerequisiteMessage,
    point80ControlMode: typedControlOk ? "core" : "blocked",
  };
}
