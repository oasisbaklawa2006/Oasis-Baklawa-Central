/**
 * Point88 — blocks legacy direct production table mutations outside governed
 * Core RPCs. Mirrors the dispatch-finalization fail-closed guard pattern.
 */

export const PHH_OPERATIONS_ROUTE = "/operations-controller";

export const LEGACY_PRODUCTION_MUTATION_MESSAGE =
  "Production targets, allocation, and lifecycle state are governed only via Core production_jobs RPCs (Point88). Legacy direct table writes are disabled.";

export interface LegacyProductionBlockResult {
  blocked: true;
  message: string;
  route: string;
}

export function blockLegacyProductionMutation(source: string): LegacyProductionBlockResult {
  return {
    blocked: true,
    message: `${LEGACY_PRODUCTION_MUTATION_MESSAGE} (source: ${source})`,
    route: PHH_OPERATIONS_ROUTE,
  };
}

export const LEGACY_PRODUCTION_MUTATION_RELATIONS = [
  "production_jobs",
  "daily_production_logs",
  "production_pauses",
  "production_rgs_transfers",
] as const;
