/**
 * Narrow adapter to Core Macro Finance #255.
 * Fail closed until production-certified contracts exist — never invent monetary truth.
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
}

/** Core #255 contract bindings — unavailable until Core certifies production authority. */
const CORE_FINANCE_255_REGISTRY: Record<
  CoreFinance255Capability,
  Omit<CoreFinance255CapabilityStatus, "capability">
> = {
  portfolio_ageing_authoritative: {
    available: false,
    semantics: "unavailable",
    coreContract: "get_finance_portfolio_ageing_v1",
    blocker: "Core #255 portfolio ageing contract not production-certified",
  },
  profitability_margin: {
    available: false,
    semantics: "unavailable",
    coreContract: "get_finance_profitability_facts_v1",
    blocker: "Core #255 profitability contract not production-certified",
  },
  credit_exposure_macro: {
    available: false,
    semantics: "unavailable",
    coreContract: "get_finance_credit_exposure_v1",
    blocker: "Core #255 credit exposure macro contract not production-certified",
  },
  commission_macro: {
    available: false,
    semantics: "unavailable",
    coreContract: "get_finance_commission_macro_v1",
    blocker: "Core #255 commission macro contract not production-certified",
  },
  forecast_revenue: {
    available: false,
    semantics: "forecast",
    coreContract: "get_finance_revenue_forecast_v1",
    blocker: "Core #255 revenue forecast contract not production-certified",
  },
  recoverable_vs_recovered_macro: {
    available: false,
    semantics: "unavailable",
    coreContract: "get_finance_collections_macro_v1",
    blocker: "Core #255 collections macro contract not production-certified",
  },
};

export function getCoreFinance255CapabilityStatus(
  capability: CoreFinance255Capability,
): CoreFinance255CapabilityStatus {
  const entry = CORE_FINANCE_255_REGISTRY[capability];
  return { capability, ...entry };
}

export function listCoreFinance255Blockers(): string[] {
  return Object.values(CORE_FINANCE_255_REGISTRY)
    .filter((e) => !e.available && e.blocker)
    .map((e) => e.blocker as string);
}

export function wrapObservedMetric<T>(
  value: T,
  source: string,
): GovernedMetric<T> {
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

/** Returns observed Central facts when Core #255 macro is unavailable. */
export function resolveFinanceMetric<T>(
  capability: CoreFinance255Capability,
  observedValue: T,
  observedSource: string,
): GovernedMetric<T> {
  const status = getCoreFinance255CapabilityStatus(capability);
  if (status.available) {
    return wrapObservedMetric(observedValue, `core:#255/${status.coreContract}`);
  }
  return wrapObservedMetric(
    observedValue,
    `${observedSource} (Central observed; Core #255 ${capability} pending)`,
  );
}

export function isCoreFinance255ProductionCertified(): boolean {
  return Object.values(CORE_FINANCE_255_REGISTRY).every((e) => e.available);
}
