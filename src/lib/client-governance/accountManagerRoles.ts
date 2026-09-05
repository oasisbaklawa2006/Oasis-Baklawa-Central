import { normalizeRole } from "@/lib/roleNormalization";

/** Canonical roles that may be assigned as B2B account managers. */
export const ACCOUNT_MANAGER_ELIGIBLE_ROLES = new Set([
  "SALES_EXECUTIVE",
  "ADMIN",
  "SUPER_ADMIN",
]);

/**
 * Legacy + canonical role strings for PostgREST `.in()` filters.
 * Production rows may use mixed case; client-side normalization is the source of truth.
 */
export const ACCOUNT_MANAGER_ROLE_DB_VALUES = [
  "SALES_EXECUTIVE",
  "sales_executive",
  "ADMIN",
  "admin",
  "SUPER_ADMIN",
  "super_admin",
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
  const roleFilters = ACCOUNT_MANAGER_ROLE_DB_VALUES.map((role) => `role.eq.${role}`).join(",");
  return `${roleFilters},is_sales_executive.eq.true`;
}
