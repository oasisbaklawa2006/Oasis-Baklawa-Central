import { IntegrationError } from "./integrationError";

export type AuthorityAvailability = "available" | "unavailable" | "degraded";

export function resolveAuthorityAvailability(
  tablesAvailable: boolean,
  loadError?: unknown,
): AuthorityAvailability {
  if (!tablesAvailable) return "unavailable";
  if (loadError) return "degraded";
  return "available";
}

/** Fail closed when backend authority is unavailable — never substitute demo data. */
export function assertAuthorityAvailable(
  availability: AuthorityAvailability,
  source: string,
): void {
  if (availability === "available") return;
  throw new IntegrationError({
    code: "authority_unavailable",
    failureClass: "unavailable",
    message: `${source} authority is unavailable. Refresh when connectivity is restored.`,
    retryable: false,
    source,
  });
}

export function isProductionRuntime(): boolean {
  return typeof import.meta !== "undefined" && Boolean(import.meta.env?.PROD);
}

/** Preview/demo fallbacks are staging-only; production must fail closed. */
export function isDemoFallbackPermitted(): boolean {
  if (isProductionRuntime()) return false;
  return (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_EXECUTION_PREVIEW_FALLBACK === "true"
  );
}

/** Stock finalization in-memory demo is staging-only; never substitute in production. */
export function isStockFinalizationDemoPermitted(): boolean {
  if (isProductionRuntime()) return false;
  return (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_STOCK_FINALIZATION_DEMO === "true"
  );
}
