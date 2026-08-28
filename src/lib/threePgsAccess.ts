import { normalizeRole } from "@/lib/auth-routing";

/**
 * Roles allowed onto 3PGS operator/management mutation surfaces.
 * Satellite catalogue/visibility routes are intentionally separate because
 * P&A, outlets, Sales and Dispatch require narrower task-specific projections,
 * not the full store-management queue.
 */
export const THREE_PGS_OPERATOR_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "STORE_3RD_PARTY",
] as const;

export function canAccessThreePgsOperator(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized !== null && THREE_PGS_OPERATOR_ROLES.includes(normalized as (typeof THREE_PGS_OPERATOR_ROLES)[number]);
}
