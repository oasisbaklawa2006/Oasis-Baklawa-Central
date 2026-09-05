import { normalizeRole } from "@/lib/roleNormalization";

/** Canonical roles that may be assigned as B2B account managers. */
export const ACCOUNT_MANAGER_ELIGIBLE_ROLES = new Set([
  "SALES_EXECUTIVE",
  "ADMIN",
  "SUPER_ADMIN",
]);

/** Canonical roles used for case-insensitive PostgREST `role.ilike` filters. */
export const ACCOUNT_MANAGER_CANONICAL_ROLES = [
  "SALES_EXECUTIVE",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export function isAccountManagerEligibleUser(
  role: string | null | undefined,
  isSalesExecutive?: boolean | null,
): boolean {
  if (isSalesExecutive) return true;
  const normalized = normalizeRole(role);
  return normalized !== null && ACCOUNT_MANAGER_ELIGIBLE_ROLES.has(normalized);
}

export function buildAccountManagerUsersOrFilter(): string {
  const roleFilters = ACCOUNT_MANAGER_CANONICAL_ROLES.map((role) => `role.ilike.${role}`).join(",");
  return `${roleFilters},is_sales_executive.eq.true`;
}
