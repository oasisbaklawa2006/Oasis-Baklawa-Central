import { classifyIntegrationError, IntegrationError } from "./integrationError";

export interface GovernedRpcErrorShape {
  message: string;
}

/** Classifies governed escape-hatch RPC failures for operator UX and retry policy. */
export function classifyGovernedRpcFailure(
  error: GovernedRpcErrorShape | null | undefined,
  source: string,
  operation: "read" | "write" = "write",
): IntegrationError | null {
  if (!error) return null;
  return classifyIntegrationError({ err: error, source, operation });
}

export function requireGovernedRpcSuccess<T>(
  result: { data: T | null; error: GovernedRpcErrorShape | null },
  source: string,
  operation: "read" | "write" = "write",
): T {
  const classified = classifyGovernedRpcFailure(result.error, source, operation);
  if (classified) throw classified;
  if (result.data === null) {
    throw classifyIntegrationError({
      err: new Error(`${source} returned no data`),
      source,
      operation,
    });
  }
  return result.data;
}
