import { normalizeRole } from "@/lib/roleNormalization";
import { getAllowedModulesForRole, hasModuleAccess } from "@/lib/appverse/roleAccess";
import type { ThreePgsSatelliteAudience } from "@/lib/threePgsSatelliteModel";

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

const THREE_PGS_SATELLITE_ROLE_AUDIENCE: Record<string, ThreePgsSatelliteAudience> = {
  HOD_ASSEMBLY: "pna",
  ASSEMBLY_MANAGER: "pna",
  PACKING_SUPERVISOR: "pna",
  STORE_READY_GOODS: "outlet",
  STORE_INCHARGE: "outlet",
  RGS_ADMIN: "outlet",
  SALES_EXECUTIVE: "b2b",
  DISPATCH_HEAD: "dispatch",
  DISPATCH_MANAGER: "dispatch",
  DISPATCH_INCHARGE: "dispatch",
};

export const THREE_PGS_MOBILE_URGENT_ROLES = [
  ...THREE_PGS_OPERATOR_ROLES,
] as const;

export const THREE_PGS_TV_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "STORE_3RD_PARTY",
  "TV_3PGS",
] as const;

export function canAccessThreePgsOperator(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized !== null && THREE_PGS_OPERATOR_ROLES.includes(normalized as (typeof THREE_PGS_OPERATOR_ROLES)[number]);
}

export function resolveThreePgsSatelliteAudience(role: string | null | undefined): ThreePgsSatelliteAudience | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  return THREE_PGS_SATELLITE_ROLE_AUDIENCE[normalized] ?? null;
}

export function canAccessThreePgsSatellite(role: string | null | undefined): boolean {
  return resolveThreePgsSatelliteAudience(role) !== null;
}

export function canAccessThreePgsMobileUrgent(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized !== null && THREE_PGS_MOBILE_URGENT_ROLES.includes(normalized as (typeof THREE_PGS_MOBILE_URGENT_ROLES)[number]);
}

export function canAccessThreePgsTv(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized !== null && THREE_PGS_TV_ROLES.includes(normalized as (typeof THREE_PGS_TV_ROLES)[number]);
}

/**
 * Admin-shell alias for the 3PGS TV wall. Kiosk-only `TV_3PGS` accounts land on
 * `/tv/3pgs` and are intentionally excluded from broad `ADMIN_STAFF_ROLES`, so
 * they must not be widened into generic inventory/admin authority here.
 */
export function canAccessThreePgsTvAdminShell(role: string | null | undefined): boolean {
  if (!canAccessThreePgsTv(role)) return false;
  return hasModuleAccess(getAllowedModulesForRole(role), "inventory");
}
