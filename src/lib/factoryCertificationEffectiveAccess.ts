import {
  ADMIN_STAFF_ROLES_REFERENCE,
  FACTORY_OPERATIONS_ROUTES,
  type FactoryRouteEntry,
} from "./factoryOperationsRouteRegistry";
import { getAllowedModulesForRole, hasModuleAccess } from "./appverse/roleAccess";
import { getRequiredModuleForAdminPath } from "./appverse/routeAccess";
import { canAccessThreePgsOperator } from "./threePgsAccess";

/**
 * Factory certification must reproduce Central's complete route authorization,
 * not only the outer RoleProtectedRoute declared in App.tsx.
 *
 * For /admin/* routes the rendered child is also wrapped by AdminRouteGuard,
 * which maps the concrete path to an App-Verse module and checks roleAccess.
 * A role therefore counts as executable certification authority only when it
 * passes both layers. The R4 3PGS procurement queue adds a narrower operator
 * gate inside AdminModuleRoute; certification mirrors that gate here instead
 * of broadening runtime RBAC merely to make a route-health test pass.
 *
 * LEGACY_REDIRECT entries are pure <Navigate> aliases with deliberately empty
 * technicallyAllowedRoles -- any authenticated staff role can hit the alias
 * URL and be bounced onward, so authorization is evaluated against the
 * redirect target's real guard, not the alias itself.
 */
export function isEffectivelyAuthorizedFactoryRole(
  entry: FactoryRouteEntry,
  role: string,
): boolean {
  if (entry.status === "LEGACY_REDIRECT" && entry.legacyRedirectTarget) {
    const target = FACTORY_OPERATIONS_ROUTES.find((candidate) => candidate.route === entry.legacyRedirectTarget);
    if (target) return isEffectivelyAuthorizedFactoryRole(target, role);
  }

  const canonicalRole = role.trim().toUpperCase();
  if (!entry.technicallyAllowedRoles.includes(canonicalRole)) return false;

  if (!entry.route.startsWith("/admin")) return true;

  const requiredModule = getRequiredModuleForAdminPath(entry.route);
  if (!requiredModule) return false;
  if (!hasModuleAccess(getAllowedModulesForRole(canonicalRole), requiredModule)) return false;

  if (entry.route === "/admin/3pgs-procurement-queue") {
    return canAccessThreePgsOperator(canonicalRole);
  }

  return true;
}

/**
 * Prefer the declared intended audience when that role can actually traverse
 * every runtime authorization layer. Otherwise choose the first real role that
 * can. This keeps route-health proof truthful without widening production RBAC
 * merely to make certification green.
 */
export function resolveEffectiveFactoryCertificationRole(entry: FactoryRouteEntry): string {
  const target =
    entry.status === "LEGACY_REDIRECT" && entry.legacyRedirectTarget
      ? FACTORY_OPERATIONS_ROUTES.find((candidate) => candidate.route === entry.legacyRedirectTarget)
      : undefined;

  const candidates = Array.from(
    new Set([
      ...entry.intendedPrimaryAudience,
      ...(target?.intendedPrimaryAudience ?? []),
      ...entry.technicallyAllowedRoles,
      ...(target?.technicallyAllowedRoles ?? []),
      ...ADMIN_STAFF_ROLES_REFERENCE,
    ].map((candidateRole) => candidateRole.trim().toUpperCase())),
  );

  const role = candidates.find((candidate) => isEffectivelyAuthorizedFactoryRole(entry, candidate));
  if (!role) {
    throw new Error(`NO_EFFECTIVE_CERTIFICATION_ROLE: ${entry.route} has no role that passes the complete runtime authorization chain`);
  }
  return role;
}
