import {
  ADMIN_STAFF_ROLES_REFERENCE,
  type FactoryRouteEntry,
} from "./factoryOperationsRouteRegistry";
import { getAllowedModulesForRole, hasModuleAccess } from "./appverse/roleAccess";
import { getRequiredModuleForAdminPath } from "./appverse/routeAccess";

/**
 * Factory certification must reproduce Central's complete route authorization,
 * not only the outer RoleProtectedRoute declared in App.tsx.
 *
 * For /admin/* routes the rendered child is also wrapped by AdminRouteGuard,
 * which maps the concrete path to an App-Verse module and checks roleAccess.
 * A role therefore counts as executable certification authority only when it
 * passes both layers. Non-admin routes use their explicit RoleProtectedRoute
 * role list directly.
 */
export function isEffectivelyAuthorizedFactoryRole(
  entry: FactoryRouteEntry,
  role: string,
): boolean {
  const canonicalRole = role.trim().toUpperCase();
  if (!entry.technicallyAllowedRoles.includes(canonicalRole)) return false;

  if (!entry.route.startsWith("/admin")) return true;

  const requiredModule = getRequiredModuleForAdminPath(entry.route);
  if (!requiredModule) return false;

  return hasModuleAccess(getAllowedModulesForRole(canonicalRole), requiredModule);
}

/**
 * Prefer the declared intended audience when that role can actually traverse
 * every runtime authorization layer. Otherwise choose the first real role that
 * can. This keeps route-health proof truthful without widening production RBAC
 * merely to make certification green.
 */
export function resolveEffectiveFactoryCertificationRole(entry: FactoryRouteEntry): string {
  const candidates = Array.from(
    new Set([
      ...entry.intendedPrimaryAudience,
      ...entry.technicallyAllowedRoles,
      ...ADMIN_STAFF_ROLES_REFERENCE,
    ].map((role) => role.trim().toUpperCase())),
  );

  const role = candidates.find((candidate) => isEffectivelyAuthorizedFactoryRole(entry, candidate));
  if (!role) {
    throw new Error(`NO_EFFECTIVE_CERTIFICATION_ROLE: ${entry.route} has no role that passes the complete runtime authorization chain`);
  }
  return role;
}
