/**
 * Core Macro Finance #255 — read-only management reporting bindings.
 *
 * Production anchor: Core main cd078c5256f7fc4fecffb86cd30df20a94f3efae
 * Central consumes deployed canonical Finance RPCs only; never writes ledger state.
 */

import type { GovernedMetric, MetricSemantics } from "./managementReportingTypes";

export type CoreFinance255Capability =
  | "portfolio_ageing_authoritative"
  | "profitability_margin"
  | "credit_exposure_macro"
  | "commission_macro"
  | "forecast_revenue"
  | "recoverable_vs_recovered_macro";

export interface CoreFinance255CapabilityStatus {
  capability: CoreFinance255Capability;
  available: boolean;
  semantics: MetricSemantics;
  coreContract: string | null;
  blocker: string | null;
  productionAnchor: string;
}

/** Verified Core #255 production anchor on Core main. */
export const CORE_FINANCE_255_PRODUCTION_ANCHOR =
  "cd078c5256f7fc4fecffb86cd30df20a94f3efae";

interface RegistryEntry {
  available: boolean;
  semantics: MetricSemantics;
  coreContract: string | null;
  blocker: string | null;
}

/**
 * Bindings to deployed canonical Finance contracts (read-only).
 * Macro-level portfolio/profitability/forecast/commission remain unavailable
 * until a dedicated Core macro RPC exists — never invent monetary truth.
 */
const CORE_FINANCE_255_REGISTRY: Record<CoreFinance255Capability, RegistryEntry> = {
  recoverable_vs_recovered_macro: {
    available: true,
    semantics: "observed",
    coreContract: "get_order_payment_facts_v1",
    blocker: null,
  },
  credit_exposure_macro: {
    available: true,
    semantics: "observed",
    coreContract: "get_credit_exposure_facts_v1",
    blocker: null,
  },
  portfolio_ageing_authoritative: {
    available: false,
    semantics: "unavailable",
    coreContract: null,
    blocker:
      "No portfolio-level ageing macro RPC deployed on Core #255; ageing uses bounded Central order.created_at aggregate",
  },
  profitability_margin: {
    available: false,
    semantics: "unavailable",
    coreContract: null,
    blocker: "No profitability macro RPC deployed on Core #255",
  },
  commission_macro: {
    available: false,
    semantics: "unavailable",
    coreContract: null,
    blocker: "commission_payout has no Core RPC (financeAuthorityMap FINANCE_UNAVAILABLE_CAPABILITIES)",
  },
  forecast_revenue: {
    available: false,
    semantics: "forecast",
    coreContract: null,
    blocker: "No revenue forecast macro RPC deployed on Core #255",
  },
};

export function getCoreFinance255CapabilityStatus(
  capability: CoreFinance255Capability,
): CoreFinance255CapabilityStatus {
  const entry = CORE_FINANCE_255_REGISTRY[capability];
  return { capability, productionAnchor: CORE_FINANCE_255_PRODUCTION_ANCHOR, ...entry };
}

export function listCoreFinance255Blockers(): string[] {
  return Object.entries(CORE_FINANCE_255_REGISTRY)
    .filter(([, e]) => !e.available && e.blocker)
    .map(([, e]) => e.blocker as string);
}

export function listCoreFinance255AvailableContracts(): string[] {
  return Object.values(CORE_FINANCE_255_REGISTRY)
    .filter((e) => e.available && e.coreContract)
    .map((e) => e.coreContract as string);
}

export function wrapObservedMetric<T>(value: T, source: string): GovernedMetric<T> {
  return { value, semantics: "observed", source };
}

export function wrapUnavailableMetric<T>(
  value: T,
  source: string,
  blocker: string,
): GovernedMetric<T> {
  return { value, semantics: "unavailable", source, blocker };
}

export function wrapForecastMetric<T>(
  value: T,
  source: string,
  blocker?: string,
): GovernedMetric<T> {
  return { value, semantics: "forecast", source, blocker };
}

export function coreFinance255Source(contract: string): string {
  return `core:#255/${contract}@${CORE_FINANCE_255_PRODUCTION_ANCHOR.slice(0, 7)}`;
}

/** Prefer Core #255 contract provenance when production binding exists. */
export function resolveFinanceMetric<T>(
  capability: CoreFinance255Capability,
  fallbackValue: T,
  fallbackSource: string,
): GovernedMetric<T> {
  const status = getCoreFinance255CapabilityStatus(capability);
  if (status.available && status.coreContract) {
    return wrapObservedMetric(fallbackValue, coreFinance255Source(status.coreContract));
  }
  if (status.semantics === "unavailable") {
    return wrapUnavailableMetric(
      fallbackValue,
      fallbackSource,
      status.blocker ?? `Core #255 ${capability} unavailable`,
    );
  }
  return wrapObservedMetric(fallbackValue, fallbackSource);
}

export function isCoreFinance255ProductionCertified(): boolean {
  return Object.values(CORE_FINANCE_255_REGISTRY).some((e) => e.available);
}

export function isCoreFinance255FullyCertified(): boolean {
  return Object.values(CORE_FINANCE_255_REGISTRY).every((e) => e.available);
}
